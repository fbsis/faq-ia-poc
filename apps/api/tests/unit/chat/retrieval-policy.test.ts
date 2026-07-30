import { describe, expect, it } from "vitest";
import { createAnswerCacheKey } from "../../../src/modules/chat/domain/answer-cache-key.js";
import { normalizeQuestion } from "../../../src/modules/chat/domain/normalize-question.js";
import { decideRetrieval } from "../../../src/modules/chat/domain/retrieval-policy.js";

const candidate = {
  id: "faq-1",
  canonicalQuestion: "Como redefino minha senha?",
  answer: "Use a opção Esqueci minha senha.",
  category: { id: "category-1", name: "Conta" },
  confidence: 1
};

describe("FAQ retrieval policy", () => {
  it("normalizes Portuguese text deterministically", () => {
    expect(normalizeQuestion("  COMO redefíno... MINHA senha?! ")).toBe(
      "como redefino minha senha"
    );
  });

  it("creates a non-reversible, versioned cache key", () => {
    const key = createAnswerCacheKey({
      normalizedQuestion: "como redefino minha senha",
      knowledgeVersion: 7,
      categoryId: null
    });
    expect(key).toMatch(/^faq-answer:v1:7:all:[a-f0-9]{64}$/);
    expect(key).not.toContain("senha");
  });

  it("accepts exact matches independent of semantic score", () => {
    expect(decideRetrieval({ candidate: { ...candidate, confidence: 1 }, exact: true })).toEqual({
      outcome: "answered",
      candidate: { ...candidate, confidence: 1 }
    });
  });

  it("keeps threshold boundaries unambiguous", () => {
    expect(
      decideRetrieval({ candidate: { ...candidate, confidence: 0.78 }, exact: false }).outcome
    ).toBe("answered");
    expect(
      decideRetrieval({ candidate: { ...candidate, confidence: 0.7 }, exact: false }).outcome
    ).toBe("ambiguous");
    expect(
      decideRetrieval({ candidate: { ...candidate, confidence: 0.699 }, exact: false }).outcome
    ).toBe("unanswered");
  });
});
