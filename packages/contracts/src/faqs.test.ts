import { describe, expect, it } from "vitest";
import {
  categoryInputSchema,
  faqInputSchema,
  faqPageSchema,
  faqSchema,
  faqStatusInputSchema
} from "./faqs.js";

const categoryId = "00000000-0000-4000-8000-000000000001";

describe("FAQ contracts", () => {
  it("validates trimmed category and FAQ inputs", () => {
    expect(categoryInputSchema.parse({ name: "  Conta e acesso  " })).toEqual({
      name: "Conta e acesso"
    });
    expect(
      faqInputSchema.parse({
        categoryId,
        question: " Como redefino minha senha? ",
        aliases: [" Esqueci minha senha "],
        answer: " Use o link enviado por e-mail. "
      })
    ).toEqual({
      categoryId,
      question: "Como redefino minha senha?",
      aliases: ["Esqueci minha senha"],
      answer: "Use o link enviado por e-mail."
    });
  });

  it("rejects duplicate aliases and malformed pagination", () => {
    expect(() =>
      faqInputSchema.parse({
        categoryId,
        question: "Como redefino minha senha?",
        aliases: ["Esqueci minha senha", "Esqueci minha senha"],
        answer: "Use o link enviado por e-mail."
      })
    ).toThrow();
    expect(() => faqPageSchema.parse({ items: [], page: 0, pageSize: 20, total: 0 })).toThrow();
  });

  it("represents pending, failed, inactive, and restored lifecycle states", () => {
    const base = {
      id: "00000000-0000-4000-8000-000000000002",
      category: { id: categoryId, name: "Conta" },
      question: "Como redefino minha senha?",
      aliases: [],
      answer: "Use o link enviado por e-mail.",
      contentVersion: 2,
      createdAt: "2026-07-30T12:00:00.000Z",
      updatedAt: "2026-07-30T12:00:00.000Z"
    };

    expect(faqSchema.parse({ ...base, status: "embedding_pending" }).status).toBe(
      "embedding_pending"
    );
    expect(
      faqSchema.parse({ ...base, status: "embedding_failed", embeddingError: "provider timeout" })
        .embeddingError
    ).toBe("provider timeout");
    expect(faqStatusInputSchema.parse({ active: false })).toEqual({ active: false });
    expect(faqStatusInputSchema.parse({ active: true })).toEqual({ active: true });
  });
});
