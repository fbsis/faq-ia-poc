import { describe, expect, it } from "vitest";
import { buildApplication } from "../../src/bootstrap/build-application.js";

describe("authentication HTTP contract", () => {
  it("sets an HTTP-only cookie and returns a CSRF token after login", async () => {
    const app = await buildApplication({ mode: "test" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@example.com", password: "change-this-password" }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["x-csrf-token"]).toBeTypeOf("string");
    await app.close();
  });

  it("protects the session and logout routes", async () => {
    const app = await buildApplication({ mode: "test" });
    expect((await app.inject({ method: "GET", url: "/api/v1/auth/session" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/v1/auth/logout" })).statusCode).toBe(401);
    await app.close();
  });

  it("rejects logout without a matching CSRF token", async () => {
    const app = await buildApplication({ mode: "test" });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@example.com", password: "change-this-password" }
    });
    const cookie = login.headers["set-cookie"];
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie: Array.isArray(cookie) ? cookie[0]! : cookie! }
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
