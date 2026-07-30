import { createHash } from "node:crypto";

interface AnswerCacheKeyInput {
  normalizedQuestion: string;
  knowledgeVersion: number;
  categoryId: string | null;
}

export function createAnswerCacheKey(input: AnswerCacheKeyInput): string {
  const digest = createHash("sha256").update(input.normalizedQuestion).digest("hex");
  return `faq-answer:v1:${input.knowledgeVersion}:${input.categoryId ?? "all"}:${digest}`;
}
