import { describe, expect, it } from "vitest";
import { askQuestionRequestSchema, askQuestionResponseSchema } from "./chat.js";

describe("chat contracts", () => {
  it("trims a valid question and accepts an optional category", () => {
    expect(
      askQuestionRequestSchema.parse({
        question: "  Como redefino minha senha?  ",
        categoryId: "00000000-0000-4000-8000-000000000001"
      })
    ).toEqual({
      question: "Como redefino minha senha?",
      categoryId: "00000000-0000-4000-8000-000000000001"
    });
  });

  it("rejects empty, oversized, and unknown input", () => {
    expect(() => askQuestionRequestSchema.parse({ question: "  " })).toThrow();
    expect(() => askQuestionRequestSchema.parse({ question: "x".repeat(501) })).toThrow();
    expect(() => askQuestionRequestSchema.parse({ question: "Pergunta", hidden: true })).toThrow();
  });

  it("accepts at most six recent conversation messages", () => {
    const history = [
      { role: "user", content: "Não consigo entrar na minha conta." },
      { role: "assistant", content: "Você ainda tem acesso ao e-mail cadastrado?" }
    ];

    expect(
      askQuestionRequestSchema.parse({
        question: "Não, o que faço agora?",
        history
      })
    ).toMatchObject({ history });

    expect(() =>
      askQuestionRequestSchema.parse({
        question: "Continue",
        history: Array.from({ length: 7 }, (_, index) => ({
          role: index % 2 === 0 ? "user" : "assistant",
          content: `Message ${index}`
        }))
      })
    ).toThrow();
  });

  it.each(["answered", "ambiguous", "unanswered"] as const)(
    "accepts the %s response status",
    (status) => {
      expect(
        askQuestionResponseSchema.parse({
          interactionId: "00000000-0000-4000-8000-000000000010",
          status,
          message: "Resultado processado."
        }).status
      ).toBe(status);
    }
  );
});
