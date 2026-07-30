import { createDatabasePool } from "../infrastructure/database/client.js";
import type { Environment } from "../infrastructure/config/environment.js";
import { createQueueRedis, createCacheRedis } from "../infrastructure/redis/connections.js";
import { PostgresAnalyticsRepository } from "../modules/analytics/adapters/outbound/postgres-analytics-repository.js";
import { ScryptPasswordHasher } from "../modules/auth/adapters/outbound/password-hasher.js";
import { PostgresAuthRepository } from "../modules/auth/adapters/outbound/postgres-auth-repository.js";
import { DeterministicEmbeddingProvider } from "../modules/chat/adapters/outbound/deterministic-embedding-provider.js";
import { deterministicConversationAgent } from "../modules/chat/adapters/outbound/deterministic-conversation-agent.js";
import { OpenAiConversationAgent } from "../modules/chat/adapters/outbound/openai-conversation-agent.js";
import { OpenAiEmbeddingProvider } from "../modules/chat/adapters/outbound/openai-embedding-provider.js";
import { PostgresFaqSearch } from "../modules/chat/adapters/outbound/postgres-faq-search.js";
import {
  PostgresInteractionRepository,
  PostgresKnowledgeVersion
} from "../modules/chat/adapters/outbound/postgres-interaction-repository.js";
import { RedisAnswerCache } from "../modules/chat/adapters/outbound/redis-answer-cache.js";
import { PostgresFaqRepository } from "../modules/faq/adapters/outbound/postgres-faq-repository.js";
import { PostgresKnowledgeGapRepository } from "../modules/knowledge-gaps/adapters/outbound/postgres-knowledge-gap-repository.js";
import { PostgresUnansweredRecorder } from "../modules/knowledge-gaps/adapters/outbound/postgres-unanswered-recorder.js";
import type { ApplicationResources } from "./application-resources.js";

export function createRuntimeResources(environment: Environment): ApplicationResources {
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
