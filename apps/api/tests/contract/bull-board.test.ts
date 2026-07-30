import { describe, expect, it } from "vitest";
import { buildApplication } from "../../src/bootstrap/build-application.js";
import {
  createBullBoardPolicy,
  redactQueuePayload
} from "../../src/infrastructure/queue/bull-board.js";

describe("Bull Board operations dashboard", () => {
  it("denies anonymous access and allows an authenticated administrator", async () => {
    const app = await buildApplication({ mode: "test" });
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
