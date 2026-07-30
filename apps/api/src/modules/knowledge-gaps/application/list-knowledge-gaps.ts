import type { KnowledgeGapListQuery } from "@faq/contracts";
import type { KnowledgeGapRepository } from "./ports.js";

export class ListKnowledgeGaps {
  constructor(private readonly repository: KnowledgeGapRepository) {}

  execute(query: KnowledgeGapListQuery) {
    return this.repository.list(query);
  }
}
