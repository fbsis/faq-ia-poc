import { analyticsSummarySchema, errorEnvelopeSchema } from "@faq/contracts";
import { describe, expect, it } from "vitest";
import { buildApplication } from "../../src/bootstrap/build-application.js";

describe("GET /api/v1/analytics/summary", () => {
  it("rejects anonymous access", async () => {
    const app = await buildApplication({ mode: "test" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/summary?from=2026-07-01&to=2026-07-31"
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("returns one validated summary for an authenticated administrator", async () => {
    const app = await buildApplication({ mode: "test" });
    const cookie = await login(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/summary?from=2026-07-01&to=2026-07-31",
      headers: { cookie }
    });

    expect(response.statusCode).toBe(200);
    expect(analyticsSummarySchema.parse(response.json()).range).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
      timeZone: "America/Sao_Paulo",
      granularity: "day"
    });
    await app.close();
  });

  it("returns the shared validation envelope for an invalid range", async () => {
    const app = await buildApplication({ mode: "test" });
    const cookie = await login(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/summary?from=2026-08-01&to=2026-07-01",
      headers: { cookie }
    });

    expect(response.statusCode).toBe(400);
    expect(errorEnvelopeSchema.parse(response.json()).code).toBe("VALIDATION_ERROR");
    await app.close();
  });
});

async function login(app: Awaited<ReturnType<typeof buildApplication>>): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: "admin@example.com", password: "change-this-password" }
  });
  const cookie = response.headers["set-cookie"];
  return Array.isArray(cookie) ? cookie[0]! : cookie!;
}
