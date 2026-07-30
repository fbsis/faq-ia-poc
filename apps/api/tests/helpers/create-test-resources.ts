import type { KnowledgeGapDetails } from "@faq/contracts";
import type { ApplicationResources } from "../../src/bootstrap/application-resources.js";
import type { Environment } from "../../src/infrastructure/config/environment.js";
import { ScryptPasswordHasher } from "../../src/modules/auth/adapters/outbound/password-hasher.js";
import type { Admin } from "../../src/modules/auth/domain/admin.js";
import { DeterministicEmbeddingProvider } from "../../src/modules/chat/adapters/outbound/deterministic-embedding-provider.js";
import { deterministicConversationAgent } from "../../src/modules/chat/adapters/outbound/deterministic-conversation-agent.js";
import { InMemoryAuthRepository } from "./fakes.js";
import { MemoryAnalyticsRepository } from "./memory-analytics-repository.js";
import {
  MemoryAnswerCache,
  MemoryFaqSearch,
  MemoryInteractionRepository,
  MemoryUnansweredRecorder
} from "./memory-chat-adapters.js";
import { MemoryFaqRepository } from "./memory-faq-repository.js";
import { MemoryKnowledgeGapRepository } from "./memory-knowledge-gap-repository.js";

export interface TestResourceOverrides {
  failInteractionRecording?: boolean;
  knowledgeGap?: KnowledgeGapDetails;
}

export async function createTestResources(
  environment: Environment,
  overrides?: TestResourceOverrides
): Promise<ApplicationResources> {
  const passwords = new ScryptPasswordHasher();
  const admin: Admin = {
    id: "00000000-0000-4000-8000-000000000001",
    email: environment.ADMIN_EMAIL,
    displayName: "FAQ Admin",
    passwordHash: await passwords.hash(environment.ADMIN_PASSWORD),
    active: true
  };
  const auth = new InMemoryAuthRepository();
  auth.admins.push(admin);

  return {
    auth,
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
