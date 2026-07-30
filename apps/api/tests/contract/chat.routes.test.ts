import { describe, expect, it } from "vitest";
import { askQuestionResponseSchema, errorEnvelopeSchema } from "@faq/contracts";
import { buildApplication } from "../../src/bootstrap/build-application.js";

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
});
