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

  it("treats an optional article before a possessive as the same FAQ wording", () => {
    expect(normalizeQuestion("Como redefino a minha senha?")).toBe(
      normalizeQuestion("Como redefino minha senha?")
    );
    expect(normalizeQuestion("Onde encontro os meus pedidos?")).toBe(
      normalizeQuestion("Onde encontro meus pedidos?")
    );
  });

  it("creates a non-reversible, versioned cache key", () => {
    const key = createAnswerCacheKey({
      normalizedQuestion: "como redefino minha senha",
      knowledgeVersion: 7,
      categoryId: null
    });
    expect(key).toMatch(/^faq-answer:v2:7:all:[a-f0-9]{64}$/);
    expect(key).not.toContain("senha");
  });

  it("accepts exact matches independent of semantic score", () => {
    expect(decideRetrieval({ candidates: [{ ...candidate, confidence: 1 }], exact: true })).toEqual(
      {
        outcome: "answered",
        candidate: { ...candidate, confidence: 1 }
      }
    );
  });

  it("answers a single plausible candidate instead of asking for confirmation", () => {
    expect(
      decideRetrieval({ candidates: [{ ...candidate, confidence: 0.78 }], exact: false }).outcome
    ).toBe("answered");
    expect(
      decideRetrieval({ candidates: [{ ...candidate, confidence: 0.7 }], exact: false }).outcome
    ).toBe("answered");
    expect(
      decideRetrieval({ candidates: [{ ...candidate, confidence: 0.699 }], exact: false }).outcome
    ).toBe("unanswered");
  });

  it("suggests alternatives only when multiple plausible candidates compete", () => {
    const alternatives = [
      {
        ...candidate,
        id: "faq-1",
        canonicalQuestion: "Como redefino minha senha?",
        confidence: 0.74
      },
      { ...candidate, id: "faq-2", canonicalQuestion: "Como altero minha senha?", confidence: 0.72 }
    ];

    expect(decideRetrieval({ candidates: alternatives, exact: false })).toEqual({
      outcome: "ambiguous",
      candidate: alternatives[0],
      suggestions: alternatives
    });
  });
});
