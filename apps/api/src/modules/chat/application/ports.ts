import type { FaqCandidate } from "../domain/faq-candidate.js";
import type { Interaction } from "../domain/interaction.js";

export interface FaqSearch {
  findExact(normalizedQuestion: string, categoryId: string | null): Promise<FaqCandidate | null>;
  findSemantic(
    embedding: number[],
    categoryId: string | null,
    limit: number
  ): Promise<FaqCandidate[]>;
  findFullText(
    normalizedQuestion: string,
    categoryId: string | null,
    limit: number
  ): Promise<FaqCandidate[]>;
}

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export interface CachedAnswer {
  readonly status: "answered" | "ambiguous" | "unanswered";
  readonly candidate?: FaqCandidate;
}

export interface AnswerCache {
  get(key: string): Promise<CachedAnswer | null>;
  set(key: string, value: CachedAnswer): Promise<void>;
}

export interface InteractionRepository {
  save(interaction: Interaction): Promise<void>;
}

export interface KnowledgeVersion {
  current(): Promise<number>;
}
