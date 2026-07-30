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
      {
        role: "assistant",
        content: "Você ainda tem acesso ao e-mail cadastrado?",
        status: "unanswered"
      }
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

  it("accepts an outcome only on assistant history messages", () => {
    expect(() =>
      askQuestionRequestSchema.parse({
        question: "Pode tentar novamente?",
        history: [
          {
            role: "assistant",
            content: "Talvez eu precise de mais explicações.",
            status: "unanswered"
          }
        ]
      })
    ).not.toThrow();

    expect(() =>
      askQuestionRequestSchema.parse({
        question: "Pode tentar novamente?",
        history: [{ role: "user", content: "Minha dúvida", status: "unanswered" }]
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

  it("accepts a social acknowledgement without an FAQ interaction", () => {
    expect(
      askQuestionResponseSchema.parse({
        status: "social",
        message: "Ok, obrigado! Fico feliz que tenha funcionado. Espero ter sido útil."
      })
    ).toEqual({
      status: "social",
      message: "Ok, obrigado! Fico feliz que tenha funcionado. Espero ter sido útil."
    });
  });
});
