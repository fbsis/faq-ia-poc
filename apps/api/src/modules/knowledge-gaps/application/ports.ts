import type { KnowledgeGapDetails, KnowledgeGapListQuery, KnowledgeGapPage } from "@faq/contracts";
import type { Interaction } from "../../chat/domain/interaction.js";

export interface UnansweredInteractionRecorder {
  record(interaction: Interaction): Promise<void>;
}

export interface KnowledgeGapRepository {
  list(query: KnowledgeGapListQuery): Promise<KnowledgeGapPage>;
  get(id: string): Promise<KnowledgeGapDetails | null>;
}
