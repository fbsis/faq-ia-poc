import type { Redis } from "ioredis";
import type { DatabasePool } from "../infrastructure/database/client.js";
import type { AnalyticsRepository } from "../modules/analytics/application/ports.js";
import type { AdminRepository, SessionRepository } from "../modules/auth/application/ports.js";
import type {
  AnswerCache,
  ConversationAgent,
  EmbeddingProvider,
  FaqSearch,
  InteractionRepository,
  KnowledgeVersion
} from "../modules/chat/application/ports.js";
import type { CategoryRepository, FaqRepository } from "../modules/faq/application/ports.js";
import type {
  KnowledgeGapRepository,
  UnansweredInteractionRecorder
} from "../modules/knowledge-gaps/application/ports.js";
import type { PasswordHasher } from "../shared/domain/ports.js";

export interface ApplicationResources {
  auth: AdminRepository & SessionRepository;
  passwords: PasswordHasher;
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
