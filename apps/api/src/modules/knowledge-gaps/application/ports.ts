import type {
  GapResolution,
  KnowledgeGapDetails,
  KnowledgeGapListQuery,
  KnowledgeGapPage,
  ResolveKnowledgeGapInput
} from "@faq/contracts";
import type { Interaction } from "../../chat/domain/interaction.js";

export interface UnansweredInteractionRecorder {
  record(interaction: Interaction): Promise<void>;
}

export interface KnowledgeGapRepository {
  list(query: KnowledgeGapListQuery): Promise<KnowledgeGapPage>;
  get(id: string): Promise<KnowledgeGapDetails | null>;
  resolve(command: ResolveKnowledgeGapCommand): Promise<GapResolution>;
}

export interface ResolveKnowledgeGapCommand {
  knowledgeGapId: string;
  adminId: string;
  resolutionId: string;
  faqId: string;
  eventId: string;
  outboxId: string;
  idempotencyKey: string;
  input: ResolveKnowledgeGapInput;
  createdAt: Date;
}
