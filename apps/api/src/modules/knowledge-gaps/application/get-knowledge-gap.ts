import { AppError } from "../../../infrastructure/http/errors.js";
import type { KnowledgeGapRepository } from "./ports.js";

export class GetKnowledgeGap {
  constructor(private readonly repository: KnowledgeGapRepository) {}

  async execute(id: string) {
    const gap = await this.repository.get(id);
    if (!gap) {
      throw new AppError("KNOWLEDGE_GAP_NOT_FOUND", "Knowledge gap not found.", 404);
    }
    return gap;
  }
}
