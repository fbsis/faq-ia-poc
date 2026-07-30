import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import { loadEnvironment, type Environment } from "../infrastructure/config/environment.js";
import { registerErrorHandler } from "../infrastructure/http/errors.js";
import { observabilityOptions } from "../infrastructure/http/observability.js";
import { registerSecurityHeaders } from "../infrastructure/http/security.js";
import {
  MetricsRegistry,
  registerHttpMetrics,
  registerMetricsRoute
} from "../infrastructure/observability/metrics.js";
import { registerBullBoard } from "../infrastructure/queue/bull-board.js";
import { registerAnalyticsRoutes } from "../modules/analytics/adapters/inbound/http/analytics-routes.js";
import { GetAnalyticsSummary } from "../modules/analytics/application/get-analytics-summary.js";
import { registerAuthRoutes } from "../modules/auth/adapters/inbound/http/auth-routes.js";
import { GetSession } from "../modules/auth/application/get-session.js";
import { Login } from "../modules/auth/application/login.js";
import { Logout } from "../modules/auth/application/logout.js";
import { registerChatRoutes } from "../modules/chat/adapters/inbound/http/chat-routes.js";
import { AskQuestion } from "../modules/chat/application/ask-question.js";
import { registerFaqRoutes } from "../modules/faq/adapters/inbound/http/faq-routes.js";
import { createFaqUseCases } from "../modules/faq/application/faq-use-cases.js";
import { registerKnowledgeGapRoutes } from "../modules/knowledge-gaps/adapters/inbound/http/knowledge-gap-routes.js";
import { DismissKnowledgeGap } from "../modules/knowledge-gaps/application/dismiss-knowledge-gap.js";
import { GetKnowledgeGap } from "../modules/knowledge-gaps/application/get-knowledge-gap.js";
import { ListKnowledgeGaps } from "../modules/knowledge-gaps/application/list-knowledge-gaps.js";
import { ReopenKnowledgeGap } from "../modules/knowledge-gaps/application/reopen-knowledge-gap.js";
import { ResolveKnowledgeGap } from "../modules/knowledge-gaps/application/resolve-knowledge-gap.js";
import { RetryGapResolution } from "../modules/knowledge-gaps/application/retry-gap-resolution.js";
import { randomIds, systemClock } from "../shared/domain/ports.js";
import type { ApplicationResources } from "./application-resources.js";
import { createRuntimeResources } from "./runtime-resources.js";

export interface BuildApplicationOptions {
  environment?: Environment;
  resources?: ApplicationResources;
}

export type Application = FastifyInstance & {
  environment: Environment;
  metrics: MetricsRegistry;
};

export async function buildApplication(
  options: BuildApplicationOptions = {}
): Promise<Application> {
  const environment = options.environment ?? loadEnvironment();
  const app = await createHttpServer(environment);
  const resources = options.resources ?? createRuntimeResources(environment);

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
    connection: resources.queue
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

async function createHttpServer(environment: Environment): Promise<Application> {
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

  return app;
}
