import type { FaqListQuery, FaqPage } from "@faq/contracts";
import type { Category } from "../domain/category.js";
import type { FaqEntry } from "../domain/faq-entry.js";

export interface CategoryRepository {
  listCategories(): Promise<Category[]>;
  createCategory(category: Category): Promise<Category>;
}

export interface FaqRepository {
  listFaqs(query: FaqListQuery): Promise<FaqPage>;
  getFaq(id: string): Promise<FaqEntry | null>;
  saveFaq(faq: FaqEntry, queueEmbedding: boolean): Promise<FaqEntry>;
  incrementKnowledgeVersion(): Promise<void>;
}

export interface EmbeddingContent {
  faqId: string;
  contentVersion: number;
  text: string;
}

export interface FaqEmbeddingRepository {
  getEmbeddingContent(faqId: string): Promise<EmbeddingContent | null>;
  activateEmbedding(
    faqId: string,
    contentVersion: number,
    embedding: number[],
    resolutionId?: string
  ): Promise<void>;
  failEmbedding(
    faqId: string,
    contentVersion: number,
    message: string,
    resolutionId?: string
  ): Promise<void>;
}

export interface OutboxMessage {
  id: string;
  payload: { faqId: string; contentVersion: number; resolutionId?: string };
}

export interface OutboxRepository {
  claim(limit: number): Promise<OutboxMessage[]>;
  markPublished(ids: string[]): Promise<void>;
}

export interface EmbeddingJobPublisher {
  publish(payload: OutboxMessage["payload"], jobId: string): Promise<void>;
}
