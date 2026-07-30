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

export interface ConversationMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly status?: "answered" | "ambiguous" | "unanswered";
}

export interface ConversationAgent {
  rewriteQuestion(question: string, history: ConversationMessage[]): Promise<string>;
  createGroundedResponse(input: {
    question: string;
    history: ConversationMessage[];
    matchedQuestion: string;
    approvedAnswer: string;
  }): Promise<string>;
  createUnansweredResponse(input: {
    question: string;
    history: ConversationMessage[];
  }): Promise<string>;
}

export interface CachedAnswer {
  readonly status: "answered" | "ambiguous" | "unanswered";
  readonly candidate?: FaqCandidate;
  readonly suggestions?: FaqCandidate[];
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
