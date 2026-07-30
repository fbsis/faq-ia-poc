import { describe, expect, it } from "vitest";
import { askQuestionResponseSchema, errorEnvelopeSchema } from "@faq/contracts";
import { buildApplication } from "../helpers/build-test-application.js";

describe("POST /api/v1/chat/questions", () => {
  it("returns an approved FAQ answer", async () => {
    const app = await buildApplication({ mode: "test" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/chat/questions",
      payload: { question: "Como redefino minha senha?" }
    });

    expect(response.statusCode).toBe(200);
    expect(askQuestionResponseSchema.parse(response.json())).toMatchObject({
      status: "answered",
      answer: "Na tela de login, selecione “Esqueci minha senha”."
    });
    await app.close();
  });

  it("answers the same FAQ when Portuguese wording adds a neutral article", async () => {
    const app = await buildApplication({ mode: "test" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/chat/questions",
      payload: { question: "Como redefino a minha senha?" }
    });

    expect(response.statusCode).toBe(200);
    expect(askQuestionResponseSchema.parse(response.json())).toMatchObject({
      status: "answered",
      answer: "Na tela de login, selecione “Esqueci minha senha”.",
      matchedQuestion: "Como redefino minha senha?"
    });
    await app.close();
  });

  it("returns the shared validation envelope for an empty question", async () => {
    const app = await buildApplication({ mode: "test" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/chat/questions",
      payload: { question: " " }
    });

    expect(response.statusCode).toBe(400);
    expect(errorEnvelopeSchema.parse(response.json()).code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("returns an unanswered response for an unknown question", async () => {
    const app = await buildApplication({ mode: "test" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/chat/questions",
      payload: { question: "Como altero um dado que não está na base?" }
    });

    expect(response.statusCode).toBe(200);
    expect(askQuestionResponseSchema.parse(response.json())).toMatchObject({
      status: "unanswered"
    });
    await app.close();
  });

  it("answers a unique plausible approved match without asking for confirmation", async () => {
    const app = await buildApplication({ mode: "test" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/chat/questions",
      payload: { question: "Não consigo acessar minha conta" }
    });

    expect(response.statusCode).toBe(200);
    expect(askQuestionResponseSchema.parse(response.json())).toMatchObject({
      status: "answered",
      matchedQuestion: "Como redefino minha senha?"
    });
    expect(response.json()).toHaveProperty("answer");
    expect(response.json()).not.toHaveProperty("suggestions");
    await app.close();
  });

  it("returns a stable unavailable envelope when recording cannot commit", async () => {
    const app = await buildApplication({
      mode: "test",
      testOverrides: { failInteractionRecording: true }
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/chat/questions",
      payload: { question: "Pergunta desconhecida" }
    });

    expect(response.statusCode).toBe(503);
    expect(errorEnvelopeSchema.parse(response.json())).toMatchObject({
      code: "CHAT_UNAVAILABLE",
      message: "Não foi possível registrar sua pergunta com segurança. Tente novamente."
    });
    await app.close();
  });
});
