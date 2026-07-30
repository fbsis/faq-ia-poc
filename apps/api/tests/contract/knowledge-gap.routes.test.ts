import { errorEnvelopeSchema, knowledgeGapPageSchema } from "@faq/contracts";
import { describe, expect, it } from "vitest";
import { buildApplication } from "../../src/bootstrap/build-application.js";

describe("knowledge gap HTTP contract", () => {
  it("rejects anonymous inbox access", async () => {
    const app = await buildApplication({ mode: "test" });
    const response = await app.inject({ method: "GET", url: "/api/v1/knowledge-gaps" });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("returns a validated empty inbox for an administrator", async () => {
    const app = await buildApplication({ mode: "test" });
    const auth = await login(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/knowledge-gaps?page=1&pageSize=20&status=open",
      headers: { cookie: auth.cookie }
    });

    expect(response.statusCode).toBe(200);
    expect(knowledgeGapPageSchema.parse(response.json())).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0
    });
    await app.close();
  });

  it("validates inbox filters and returns stable missing-detail errors", async () => {
    const app = await buildApplication({ mode: "test" });
    const auth = await login(app);
    const invalid = await app.inject({
      method: "GET",
      url: "/api/v1/knowledge-gaps?from=2026-08-01&to=2026-07-01",
      headers: { cookie: auth.cookie }
    });
    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/knowledge-gaps/00000000-0000-4000-8000-000000000999",
      headers: { cookie: auth.cookie }
    });

    expect(errorEnvelopeSchema.parse(invalid.json()).code).toBe("VALIDATION_ERROR");
    expect(errorEnvelopeSchema.parse(missing.json())).toMatchObject({
      code: "KNOWLEDGE_GAP_NOT_FOUND"
    });
    await app.close();
  });
});

async function login(app: Awaited<ReturnType<typeof buildApplication>>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: "admin@example.com", password: "change-this-password" }
  });
  const value = response.headers["set-cookie"];
  return {
    cookie: Array.isArray(value) ? value[0]! : value!
  };
}
