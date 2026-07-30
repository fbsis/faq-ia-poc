import { describe, expect, it } from "vitest";
import { buildApplication } from "../../src/bootstrap/build-application.js";
import {
  createBullBoardPolicy,
  redactQueuePayload
} from "../../src/infrastructure/queue/bull-board.js";
import { loadEnvironment } from "../../src/infrastructure/config/environment.js";

describe("Bull Board operations dashboard", () => {
  it("allows anonymous access outside production", async () => {
    const app = await buildApplication({ mode: "test" });
    const anonymous = await app.inject({ method: "GET", url: "/admin/queues" });

    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.body).toContain("Operações das filas");
    await app.close();
  });

  it("requires an authenticated administrator in production", async () => {
    const app = await buildApplication({
      mode: "test",
      environment: productionEnvironment()
    });
    const anonymous = await app.inject({ method: "GET", url: "/admin/queues" });
    const auth = await login(app);
    const authorized = await app.inject({
      method: "GET",
      url: "/admin/queues",
      headers: { cookie: auth.cookie }
    });

    expect(anonymous.statusCode).toBe(401);
    expect(authorized.statusCode).toBe(200);
    expect(authorized.body).toContain("Operações das filas");
    await app.close();
  });

  it("is read-only in production and redacts unexpected job fields", () => {
    expect(createBullBoardPolicy("production", true)).toEqual({
      readOnlyMode: true,
      allowRetries: false,
      hideRedisDetails: true
    });
    expect(createBullBoardPolicy("development", true)).toEqual({
      readOnlyMode: false,
      allowRetries: true,
      hideRedisDetails: true
    });
    expect(
      redactQueuePayload({
        faqId: "00000000-0000-4000-8000-000000000002",
        contentVersion: 3,
        resolutionId: "00000000-0000-4000-8000-000000000003",
        answer: "sensitive",
        apiKey: "secret"
      })
    ).toEqual({
      faqId: "00000000-0000-4000-8000-000000000002",
      contentVersion: 3,
      resolutionId: "00000000-0000-4000-8000-000000000003"
    });
    expect(redactQueuePayload("unexpected return value")).toEqual({ redacted: true });
  });
});

async function login(app: Awaited<ReturnType<typeof buildApplication>>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: "admin@example.com", password: "change-this-password" }
  });
  const value = response.headers["set-cookie"];
  return { cookie: Array.isArray(value) ? value[0]! : value! };
}

function productionEnvironment() {
  return loadEnvironment({
    NODE_ENV: "production",
    CONVERSATION_PROVIDER: "deterministic",
    EMBEDDING_PROVIDER: "deterministic",
    ADMIN_EMAIL: "admin@example.com",
    ADMIN_PASSWORD: "change-this-password",
    SESSION_SECRET: "test-session-secret-that-is-at-least-32-characters"
  });
}
