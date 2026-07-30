import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { DatabasePool } from "../infrastructure/database/client.js";
import { createDatabasePool } from "../infrastructure/database/client.js";
import { loadEnvironment, type Environment } from "../infrastructure/config/environment.js";
import { registerErrorHandler } from "../infrastructure/http/errors.js";
import { observabilityOptions } from "../infrastructure/http/observability.js";
import { createCacheRedis, createQueueRedis } from "../infrastructure/redis/connections.js";
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
import type { UnansweredInteractionRecorder } from "../modules/knowledge-gaps/application/ports.js";
import { randomIds, systemClock } from "../shared/domain/ports.js";

export interface BuildApplicationOptions {
  mode?: "test" | "runtime";
  environment?: Environment;
  testOverrides?: {
    failInteractionRecording?: boolean;
  };
}

export type Application = FastifyInstance & { environment: Environment };

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
  const app = Fastify(observabilityOptions()) as unknown as Application;
  app.environment = environment;

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

  registerAuthRoutes(app, { environment, login, getSession, logout });
  registerChatRoutes(app, askQuestion);
  registerAnalyticsRoutes(app, { getSession, getAnalyticsSummary });
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
  rewriteQuestion: (question) => Promise.resolve(question),
  createGroundedResponse: ({ approvedAnswer }) => Promise.resolve(approvedAnswer),
  createUnansweredResponse: () =>
    Promise.resolve(
      "Não encontrei uma resposta confiável ainda. Conte qual resultado você esperava e em qual etapa surgiu a dúvida para eu tentar uma busca mais precisa."
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
