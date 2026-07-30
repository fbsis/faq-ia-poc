import { describe, expect, it } from "vitest";
import { buildApplication } from "../../helpers/build-test-application.js";
import { loadEnvironment } from "../../../src/infrastructure/config/environment.js";

describe("HTTP security controls", () => {
  it("sets defensive headers and rejects oversized public payloads", async () => {
    const app = await buildApplication({
      mode: "test",
      environment: productionEnvironment({ HTTP_BODY_LIMIT_BYTES: "1024" })
    });
    const health = await app.inject({ method: "GET", url: "/api/v1/health" });
    const oversized = await app.inject({
      method: "POST",
      url: "/api/v1/chat/questions",
      headers: { "content-type": "application/json" },
      payload: { question: "x".repeat(2_000) }
    });

    expect(health.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "no-referrer"
    });
    expect(oversized.statusCode).toBe(413);
    await app.close();
  });

  it("rate limits public chat independently from administrator routes", async () => {
    const app = await buildApplication({
      mode: "test",
      environment: productionEnvironment({ CHAT_RATE_LIMIT_MAX: "2" })
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/chat/questions",
            payload: { question: "Como redefino minha senha?" }
          })
        ).statusCode
      ).toBe(200);
    }
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/chat/questions",
          payload: { question: "Como redefino minha senha?" }
        })
      ).statusCode
    ).toBe(429);
    expect((await app.inject({ method: "GET", url: "/api/v1/health" })).statusCode).toBe(200);
    await app.close();
  });

  it("enforces authorization, CSRF, and secure production cookies without leaking secrets", async () => {
    const app = await buildApplication({
      mode: "test",
      environment: productionEnvironment()
    });
    expect((await app.inject({ method: "GET", url: "/api/v1/faqs" })).statusCode).toBe(401);
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@example.com", password: "change-this-password" }
    });
    const cookie = String(login.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");

    const forbidden = await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      headers: { cookie },
      payload: { name: "Secret category" }
    });
    expect(forbidden.statusCode).toBe(403);
    expect(JSON.stringify(forbidden.json())).not.toContain("change-this-password");
    await app.close();
  });
});

function productionEnvironment(overrides: Record<string, string> = {}) {
  return loadEnvironment({
    NODE_ENV: "production",
    CONVERSATION_PROVIDER: "deterministic",
    EMBEDDING_PROVIDER: "deterministic",
    ADMIN_EMAIL: "admin@example.com",
    ADMIN_PASSWORD: "change-this-password",
    SESSION_SECRET: "test-session-secret-that-is-at-least-32-characters",
    ...overrides
  });
}
