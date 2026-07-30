import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import type {
  GapResolution,
  FaqListQuery,
  KnowledgeGap,
  KnowledgeGapDetails,
  KnowledgeGapListQuery,
  KnowledgeGapPage
} from "@faq/contracts";
import Fastify, { type FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { DatabasePool } from "../infrastructure/database/client.js";
import { createDatabasePool } from "../infrastructure/database/client.js";
import { loadEnvironment, type Environment } from "../infrastructure/config/environment.js";
import { registerErrorHandler } from "../infrastructure/http/errors.js";
import { observabilityOptions } from "../infrastructure/http/observability.js";
import { registerSecurityHeaders } from "../infrastructure/http/security.js";
import {
  MetricsRegistry,
  registerHttpMetrics,
  registerMetricsRoute
} from "../infrastructure/observability/metrics.js";
import { createCacheRedis, createQueueRedis } from "../infrastructure/redis/connections.js";
import { registerBullBoard } from "../infrastructure/queue/bull-board.js";
import { GetSession } from "../modules/auth/application/get-session.js";
import { Login } from "../modules/auth/application/login.js";
import { Logout } from "../modules/auth/application/logout.js";
import type { AdminRepository, SessionRepository } from "../modules/auth/application/ports.js";
import { registerAuthRoutes } from "../modules/auth/adapters/inbound/http/auth-routes.js";
import { ScryptPasswordHasher } from "../modules/auth/adapters/outbound/password-hasher.js";
import { PostgresAuthRepository } from "../modules/auth/adapters/outbound/postgres-auth-repository.js";
import type { Admin, AdminSession } from "../modules/auth/domain/admin.js";
import { registerAnalyticsRoutes } from "../modules/analytics/adapters/inbound/http/analytics-routes.js";
import { PostgresAnalyticsRepository } from "../modules/analytics/adapters/outbound/postgres-analytics-repository.js";
import { GetAnalyticsSummary } from "../modules/analytics/application/get-analytics-summary.js";
import type {
  AnalyticsMetrics,
  AnalyticsRepository
} from "../modules/analytics/application/ports.js";
import { registerChatRoutes } from "../modules/chat/adapters/inbound/http/chat-routes.js";
import { DeterministicEmbeddingProvider } from "../modules/chat/adapters/outbound/deterministic-embedding-provider.js";
import { OpenAiEmbeddingProvider } from "../modules/chat/adapters/outbound/openai-embedding-provider.js";
import { OpenAiConversationAgent } from "../modules/chat/adapters/outbound/openai-conversation-agent.js";
import { PostgresFaqSearch } from "../modules/chat/adapters/outbound/postgres-faq-search.js";
import {
  PostgresInteractionRepository,
  PostgresKnowledgeVersion
} from "../modules/chat/adapters/outbound/postgres-interaction-repository.js";
import { RedisAnswerCache } from "../modules/chat/adapters/outbound/redis-answer-cache.js";
import { AskQuestion } from "../modules/chat/application/ask-question.js";
import type {
  AnswerCache,
  CachedAnswer,
  ConversationAgent,
  EmbeddingProvider,
  FaqSearch,
  InteractionRepository,
  KnowledgeVersion
} from "../modules/chat/application/ports.js";
import type { FaqCandidate } from "../modules/chat/domain/faq-candidate.js";
import type { Interaction } from "../modules/chat/domain/interaction.js";
import { PostgresUnansweredRecorder } from "../modules/knowledge-gaps/adapters/outbound/postgres-unanswered-recorder.js";
import { registerKnowledgeGapRoutes } from "../modules/knowledge-gaps/adapters/inbound/http/knowledge-gap-routes.js";
import { PostgresKnowledgeGapRepository } from "../modules/knowledge-gaps/adapters/outbound/postgres-knowledge-gap-repository.js";
import { GetKnowledgeGap } from "../modules/knowledge-gaps/application/get-knowledge-gap.js";
import { DismissKnowledgeGap } from "../modules/knowledge-gaps/application/dismiss-knowledge-gap.js";
import { ListKnowledgeGaps } from "../modules/knowledge-gaps/application/list-knowledge-gaps.js";
import { ReopenKnowledgeGap } from "../modules/knowledge-gaps/application/reopen-knowledge-gap.js";
import { ResolveKnowledgeGap } from "../modules/knowledge-gaps/application/resolve-knowledge-gap.js";
import { RetryGapResolution } from "../modules/knowledge-gaps/application/retry-gap-resolution.js";
import type {
  DismissKnowledgeGapCommand,
  KnowledgeGapRepository,
  ReopenKnowledgeGapCommand,
  RetryGapResolutionCommand,
  ResolveKnowledgeGapCommand,
  UnansweredInteractionRecorder
} from "../modules/knowledge-gaps/application/ports.js";
import { registerFaqRoutes } from "../modules/faq/adapters/inbound/http/faq-routes.js";
import { PostgresFaqRepository } from "../modules/faq/adapters/outbound/postgres-faq-repository.js";
import { createFaqUseCases } from "../modules/faq/application/faq-use-cases.js";
import type { CategoryRepository, FaqRepository } from "../modules/faq/application/ports.js";
import type { Category } from "../modules/faq/domain/category.js";
import type { FaqEntry } from "../modules/faq/domain/faq-entry.js";
import { randomIds, systemClock } from "../shared/domain/ports.js";

export interface BuildApplicationOptions {
  mode?: "test" | "runtime";
  environment?: Environment;
  testOverrides?: {
    failInteractionRecording?: boolean;
    knowledgeGap?: KnowledgeGapDetails;
  };
}

export type Application = FastifyInstance & {
  environment: Environment;
  metrics: MetricsRegistry;
};

export async function buildApplication(
  options: BuildApplicationOptions = {}
): Promise<Application> {
  const environment =
    options.environment ??
    loadEnvironment(
      options.mode === "test"
        ? {
            ...process.env,
            NODE_ENV: "test",
            ADMIN_EMAIL: "admin@example.com",
            ADMIN_PASSWORD: "change-this-password",
            CONVERSATION_PROVIDER: "deterministic"
          }
        : process.env
    );
  const app = Fastify({
    ...observabilityOptions(),
    bodyLimit: environment.HTTP_BODY_LIMIT_BYTES
  }) as unknown as Application;
  app.environment = environment;
  app.metrics = new MetricsRegistry();
  registerHttpMetrics(app, app.metrics);
  registerSecurityHeaders(app, environment);

  await app.register(cookie, { secret: environment.SESSION_SECRET });
  await app.register(cors, {
    origin: environment.NODE_ENV === "production" ? false : true,
    credentials: true
  });
  await app.register(rateLimit, { global: false });
  registerErrorHandler(app);

  const resources =
    options.mode === "test"
      ? await createTestResources(environment, options.testOverrides)
      : createRuntimeResources(environment);

  const login = new Login(
    resources.auth,
    resources.auth,
    resources.passwords,
    systemClock,
    randomIds,
    { ttlSeconds: environment.SESSION_TTL_SECONDS }
  );
  const getSession = new GetSession(resources.auth, resources.auth, systemClock);
  const logout = new Logout(resources.auth, systemClock);
  const askQuestion = new AskQuestion({
    ...resources.chat,
    clock: systemClock,
    ids: randomIds,
    acceptanceThreshold: environment.FAQ_ACCEPTANCE_THRESHOLD,
    ambiguityThreshold: environment.FAQ_AMBIGUITY_THRESHOLD
  });
  const getAnalyticsSummary = new GetAnalyticsSummary(
    resources.analytics,
    environment.ORGANIZATION_TIME_ZONE
  );
  const listKnowledgeGaps = new ListKnowledgeGaps(resources.knowledgeGaps);
  const getKnowledgeGap = new GetKnowledgeGap(resources.knowledgeGaps);
  const resolveKnowledgeGap = new ResolveKnowledgeGap(
    resources.knowledgeGaps,
    randomIds,
    systemClock
  );
  const retryGapResolution = new RetryGapResolution(
    resources.knowledgeGaps,
    randomIds,
    systemClock
  );
  const dismissKnowledgeGap = new DismissKnowledgeGap(
    resources.knowledgeGaps,
    randomIds,
    systemClock
  );
  const reopenKnowledgeGap = new ReopenKnowledgeGap(
    resources.knowledgeGaps,
    randomIds,
    systemClock
  );
  const faqUseCases = createFaqUseCases({
    categories: resources.faq,
    faqs: resources.faq,
    ids: { create: () => randomIds.next() },
    clock: systemClock
  });

  registerAuthRoutes(app, { environment, login, getSession, logout });
  registerChatRoutes(app, askQuestion, { rateLimitMax: environment.CHAT_RATE_LIMIT_MAX });
  registerAnalyticsRoutes(app, { getSession, getAnalyticsSummary });
  registerFaqRoutes(app, { getSession, useCases: faqUseCases });
  registerKnowledgeGapRoutes(app, {
    getSession,
    listKnowledgeGaps,
    getKnowledgeGap,
    resolveKnowledgeGap,
    retryGapResolution,
    dismissKnowledgeGap,
    reopenKnowledgeGap
  });
  registerMetricsRoute(app, { getSession, metrics: app.metrics });
  await registerBullBoard(app, {
    getSession,
    environment,
    connection: resources.queue,
    testMode: options.mode === "test"
  });
  app.get("/api/v1/health", () => ({ status: "ok" }));

  app.addHook("onClose", async () => {
    await Promise.allSettled([
      resources.pool?.end(),
      resources.cache?.quit(),
      resources.queue?.quit()
    ]);
  });

  return app;
}

interface Resources {
  auth: AdminRepository & SessionRepository;
  passwords: ScryptPasswordHasher;
  analytics: AnalyticsRepository;
  knowledgeGaps: KnowledgeGapRepository;
  faq: CategoryRepository & FaqRepository;
  chat: {
    search: FaqSearch;
    cache: AnswerCache;
    interactions: InteractionRepository;
    unanswered: UnansweredInteractionRecorder;
    embeddings: EmbeddingProvider;
    conversation: ConversationAgent;
    knowledgeVersion: KnowledgeVersion;
  };
  pool?: DatabasePool;
  cache?: Redis;
  queue?: Redis;
}

function createRuntimeResources(environment: Environment): Resources {
  const pool = createDatabasePool(environment.DATABASE_URL);
  const cache = createCacheRedis(environment.CACHE_REDIS_URL);
  const embeddings =
    environment.EMBEDDING_PROVIDER === "openai"
      ? new OpenAiEmbeddingProvider(environment.OPENAI_API_KEY!, environment.OPENAI_EMBEDDING_MODEL)
      : new DeterministicEmbeddingProvider();
  const conversation =
    environment.CONVERSATION_PROVIDER === "openai"
      ? new OpenAiConversationAgent(environment.OPENAI_API_KEY!, environment.OPENAI_CHAT_MODEL)
      : deterministicConversationAgent;
  return {
    auth: new PostgresAuthRepository(pool),
    passwords: new ScryptPasswordHasher(),
    analytics: new PostgresAnalyticsRepository(pool),
    knowledgeGaps: new PostgresKnowledgeGapRepository(pool),
    faq: new PostgresFaqRepository(pool),
    chat: {
      search: new PostgresFaqSearch(pool),
      cache: new RedisAnswerCache(cache),
      interactions: new PostgresInteractionRepository(pool),
      unanswered: new PostgresUnansweredRecorder(pool),
      embeddings,
      conversation,
      knowledgeVersion: new PostgresKnowledgeVersion(pool)
    },
    pool,
    cache,
    queue: createQueueRedis(environment.QUEUE_REDIS_URL)
  };
}

async function createTestResources(
  environment: Environment,
  overrides?: BuildApplicationOptions["testOverrides"]
): Promise<Resources> {
  const passwords = new ScryptPasswordHasher();
  const admin: Admin = {
    id: "00000000-0000-4000-8000-000000000001",
    email: environment.ADMIN_EMAIL,
    displayName: "FAQ Admin",
    passwordHash: await passwords.hash(environment.ADMIN_PASSWORD),
    active: true
  };
  return {
    auth: new MemoryAuthRepository(admin),
    passwords,
    analytics: new MemoryAnalyticsRepository(),
    knowledgeGaps: new MemoryKnowledgeGapRepository(overrides?.knowledgeGap),
    faq: new MemoryFaqRepository(),
    chat: {
      search: new MemoryFaqSearch(),
      cache: new MemoryAnswerCache(),
      interactions: new MemoryInteractionRepository(),
      unanswered: new MemoryUnansweredRecorder(overrides?.failInteractionRecording),
      embeddings: new DeterministicEmbeddingProvider(),
      conversation: deterministicConversationAgent,
      knowledgeVersion: { current: () => Promise.resolve(1) }
    }
  };
}

class MemoryKnowledgeGapRepository implements KnowledgeGapRepository {
  constructor(private gap?: KnowledgeGapDetails) {}

  list(query: KnowledgeGapListQuery): Promise<KnowledgeGapPage> {
    const items = this.gap && (!query.status || query.status === this.gap.status) ? [this.gap] : [];
    return Promise.resolve({
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: items.length
    });
  }

  get(id: string): Promise<KnowledgeGapDetails | null> {
    return Promise.resolve(this.gap?.id === id ? this.gap : null);
  }

  resolve(command: ResolveKnowledgeGapCommand): Promise<GapResolution> {
    if (!this.gap || this.gap.id !== command.knowledgeGapId) {
      return Promise.reject(new Error("Knowledge gap not found."));
    }
    const resolution: GapResolution = {
      id: command.resolutionId,
      knowledgeGapId: command.knowledgeGapId,
      mode: command.input.mode,
      faqId: command.faqId,
      faqStatus: "embedding_pending",
      status: "pending",
      createdAt: command.createdAt.toISOString()
    };
    this.gap = {
      ...this.gap,
      status: "resolving",
      resolvedFaqId: command.faqId,
      version: this.gap.version + 1,
      currentResolution: resolution
    };
    return Promise.resolve(resolution);
  }

  retryResolution(command: RetryGapResolutionCommand): Promise<GapResolution> {
    if (
      !this.gap ||
      this.gap.id !== command.knowledgeGapId ||
      this.gap.version !== command.input.expectedVersion ||
      this.gap.currentResolution?.status !== "failed"
    ) {
      return Promise.reject(new Error("Knowledge gap is not eligible for retry."));
    }
    const resolution: GapResolution = {
      id: command.resolutionId,
      knowledgeGapId: command.knowledgeGapId,
      mode: this.gap.currentResolution.mode,
      faqId: this.gap.currentResolution.faqId,
      faqStatus: "embedding_pending",
      status: "pending",
      createdAt: command.createdAt.toISOString()
    };
    this.gap = {
      ...this.gap,
      status: "resolving",
      resolvedFaqId: resolution.faqId,
      version: this.gap.version + 1,
      currentResolution: resolution
    };
    return Promise.resolve(resolution);
  }

  dismiss(command: DismissKnowledgeGapCommand): Promise<KnowledgeGap> {
    return this.applyAction(command, "dismissed");
  }

  reopen(command: ReopenKnowledgeGapCommand): Promise<KnowledgeGap> {
    return this.applyAction(command, "open");
  }

  private applyAction(
    command: DismissKnowledgeGapCommand | ReopenKnowledgeGapCommand,
    status: "dismissed" | "open"
  ): Promise<KnowledgeGap> {
    if (
      !this.gap ||
      this.gap.id !== command.knowledgeGapId ||
      this.gap.version !== command.input.expectedVersion
    ) {
      return Promise.reject(new Error("Knowledge gap changed."));
    }
    this.gap = {
      ...this.gap,
      status,
      version: this.gap.version + 1
    };
    return Promise.resolve({
      id: this.gap.id,
      representativeQuestion: this.gap.representativeQuestion,
      status: this.gap.status,
      occurrenceCount: this.gap.occurrenceCount,
      firstOccurredAt: this.gap.firstOccurredAt,
      lastOccurredAt: this.gap.lastOccurredAt,
      ...(this.gap.suggestedCategory ? { suggestedCategory: this.gap.suggestedCategory } : {}),
      ...(this.gap.resolvedFaqId ? { resolvedFaqId: this.gap.resolvedFaqId } : {}),
      version: this.gap.version,
      createdAt: this.gap.createdAt,
      updatedAt: this.gap.updatedAt
    });
  }
}

class MemoryFaqRepository implements CategoryRepository, FaqRepository {
  private readonly categories: Category[] = [];
  private readonly faqs: FaqEntry[] = [];

  listCategories(): Promise<Category[]> {
    return Promise.resolve([...this.categories]);
  }

  createCategory(category: Category): Promise<Category> {
    this.categories.push(category);
    return Promise.resolve(category);
  }

  listFaqs(query: FaqListQuery) {
    const items = this.faqs
      .filter((faq) => !query.status || faq.status === query.status)
      .filter((faq) => !query.categoryId || faq.categoryId === query.categoryId)
      .map((faq) => {
        const category = this.categories.find((item) => item.id === faq.categoryId)!;
        return {
          id: faq.id,
          category: { id: category.id, name: category.name },
          question: faq.question,
          aliases: faq.aliases,
          answer: faq.answer,
          status: faq.status,
          contentVersion: faq.contentVersion,
          embeddingError: faq.embeddingError,
          createdAt: faq.createdAt.toISOString(),
          updatedAt: faq.updatedAt.toISOString()
        };
      });
    const offset = (query.page - 1) * query.pageSize;
    return Promise.resolve({
      items: items.slice(offset, offset + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: items.length
    });
  }

  getFaq(id: string): Promise<FaqEntry | null> {
    return Promise.resolve(this.faqs.find((faq) => faq.id === id) ?? null);
  }

  saveFaq(faq: FaqEntry): Promise<FaqEntry> {
    const index = this.faqs.findIndex((item) => item.id === faq.id);
    if (index >= 0) this.faqs[index] = faq;
    else this.faqs.push(faq);
    return Promise.resolve(faq);
  }

  incrementKnowledgeVersion(): Promise<void> {
    return Promise.resolve();
  }
}

class MemoryAnalyticsRepository implements AnalyticsRepository {
  getSummary(): Promise<AnalyticsMetrics> {
    return Promise.resolve({
      totalQueries: 0,
      answeredQueries: 0,
      unansweredQueries: 0,
      knowledgeGapBacklog: {
        open: 0,
        resolving: 0,
        resolved: 0,
        dismissed: 0
      },
      topQuestions: [],
      unansweredQuestions: [],
      categoryDistribution: [],
      timeline: []
    });
  }
}

const deterministicConversationAgent: ConversationAgent = {
  routeMessage: (question) => Promise.resolve({ intent: "faq", searchQuestion: question }),
  createGroundedResponse: ({ approvedAnswer }) => Promise.resolve(approvedAnswer),
  createUnansweredResponse: () =>
    Promise.resolve(
      "Você pode explicar melhor o que está tentando fazer e em qual etapa surgiu a dúvida?"
    )
};

class MemoryAuthRepository implements AdminRepository, SessionRepository {
  private readonly sessions = new Map<string, AdminSession>();

  constructor(private readonly admin: Admin) {}

  findAdminByEmail(email: string): Promise<Admin | null> {
    return Promise.resolve(email === this.admin.email ? this.admin : null);
  }

  findAdminById(id: string): Promise<Admin | null> {
    return Promise.resolve(id === this.admin.id ? this.admin : null);
  }

  createSession(session: AdminSession): Promise<void> {
    this.sessions.set(session.tokenHash, session);
    return Promise.resolve();
  }

  findSessionByTokenHash(tokenHash: string, now: Date): Promise<AdminSession | null> {
    const session = this.sessions.get(tokenHash);
    return Promise.resolve(
      session && !session.revokedAt && session.expiresAt.getTime() > now.getTime() ? session : null
    );
  }

  revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session) session.revokedAt = revokedAt;
    return Promise.resolve();
  }
}

const testFaq: FaqCandidate = {
  id: "00000000-0000-4000-8000-000000000002",
  canonicalQuestion: "Como redefino minha senha?",
  answer: "Na tela de login, selecione “Esqueci minha senha”.",
  category: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Conta"
  },
  confidence: 1
};

class MemoryFaqSearch implements FaqSearch {
  private normalizedQuestion = "";

  findExact(normalizedQuestion: string): Promise<FaqCandidate | null> {
    this.normalizedQuestion = normalizedQuestion;
    return Promise.resolve(normalizedQuestion === "como redefino minha senha" ? testFaq : null);
  }

  findSemantic(): Promise<FaqCandidate[]> {
    return Promise.resolve(
      this.normalizedQuestion === "nao consigo acessar minha conta"
        ? [{ ...testFaq, confidence: 0.74 }]
        : []
    );
  }

  findFullText(): Promise<FaqCandidate[]> {
    return Promise.resolve([]);
  }
}

class MemoryAnswerCache implements AnswerCache {
  private readonly values = new Map<string, CachedAnswer>();

  get(key: string): Promise<CachedAnswer | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  set(key: string, value: CachedAnswer): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}

class MemoryInteractionRepository implements InteractionRepository {
  readonly values: Interaction[] = [];

  save(interaction: Interaction): Promise<void> {
    this.values.push(interaction);
    return Promise.resolve();
  }
}

class MemoryUnansweredRecorder implements UnansweredInteractionRecorder {
  readonly values: Interaction[] = [];

  constructor(private readonly fail = false) {}

  record(interaction: Interaction): Promise<void> {
    if (this.fail) return Promise.reject(new Error("database unavailable"));
    this.values.push(interaction);
    return Promise.resolve();
  }
}
