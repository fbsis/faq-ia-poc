import type { FaqInput, FaqStatus } from "@faq/contracts";
import { faqInputSchema } from "@faq/contracts";
import { normalizeQuestion } from "../../chat/domain/normalize-question.js";

export interface FaqEntry {
  id: string;
  categoryId: string;
  question: string;
  normalizedQuestion: string;
  aliases: string[];
  answer: string;
  status: FaqStatus;
  contentVersion: number;
  embeddingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createFaqEntry(candidate: FaqInput, metadata: { id: string; now: Date }): FaqEntry {
  const input = faqInputSchema.parse(candidate);
  return {
    id: metadata.id,
    categoryId: input.categoryId,
    question: input.question,
    normalizedQuestion: normalizeQuestion(input.question),
    aliases: input.aliases,
    answer: input.answer,
    status: "embedding_pending",
    contentVersion: 1,
    createdAt: metadata.now,
    updatedAt: metadata.now
  };
}

export function reviseFaqEntry(faq: FaqEntry, candidate: FaqInput, now: Date): FaqEntry {
  const input = faqInputSchema.parse(candidate);
  const changed =
    faq.categoryId !== input.categoryId ||
    faq.question !== input.question ||
    faq.answer !== input.answer ||
    JSON.stringify(faq.aliases) !== JSON.stringify(input.aliases);
  if (!changed) return faq;
  return {
    ...faq,
    categoryId: input.categoryId,
    question: input.question,
    normalizedQuestion: normalizeQuestion(input.question),
    aliases: input.aliases,
    answer: input.answer,
    status: "embedding_pending",
    embeddingError: undefined,
    contentVersion: faq.contentVersion + 1,
    updatedAt: now
  };
}

export function setFaqAvailability(faq: FaqEntry, active: boolean, now: Date): FaqEntry {
  if (!active) {
    return { ...faq, status: "inactive", embeddingError: undefined, updatedAt: now };
  }
  if (faq.status !== "inactive") return faq;
  return {
    ...faq,
    status: "embedding_pending",
    embeddingError: undefined,
    contentVersion: faq.contentVersion + 1,
    updatedAt: now
  };
}

export function markEmbeddingActive(faq: FaqEntry, contentVersion: number, now: Date): FaqEntry {
  return faq.contentVersion === contentVersion
    ? { ...faq, status: "active", embeddingError: undefined, updatedAt: now }
    : faq;
}

export function markEmbeddingFailed(
  faq: FaqEntry,
  contentVersion: number,
  message: string,
  now: Date
): FaqEntry {
  return faq.contentVersion === contentVersion
    ? { ...faq, status: "embedding_failed", embeddingError: message, updatedAt: now }
    : faq;
}
