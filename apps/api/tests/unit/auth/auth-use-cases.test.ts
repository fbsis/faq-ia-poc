import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { GetSession } from "../../../src/modules/auth/application/get-session.js";
import { Login } from "../../../src/modules/auth/application/login.js";
import { Logout } from "../../../src/modules/auth/application/logout.js";
import {
  FixedClock,
  InMemoryAuthRepository,
  PlainPasswordHasher,
  SequentialIds
} from "../../helpers/fakes.js";

describe("administrator authentication", () => {
  const clock = new FixedClock();
  const ids = new SequentialIds();
  const passwords = new PlainPasswordHasher();
  let repository: InMemoryAuthRepository;

  beforeEach(() => {
    repository = new InMemoryAuthRepository();
    repository.admins.push({
      id: "admin-1",
      email: "admin@example.com",
      displayName: "FAQ Admin",
      passwordHash: "hashed:correct-password",
      active: true
    });
  });

  it("creates a bounded server session without exposing its token", async () => {
    const login = new Login(repository, repository, passwords, clock, ids, {
      ttlSeconds: 3600,
      tokenFactory: () => "opaque-session-token"
    });

    const result = await login.execute({
      email: "ADMIN@example.com",
      password: "correct-password"
    });

    expect(result).toMatchObject({ token: "opaque-session-token", admin: { id: "admin-1" } });
    expect(repository.sessions[0]?.tokenHash).toBe(
      createHash("sha256").update("opaque-session-token").digest("hex")
    );
  });

  it("returns one generic error for unknown users and invalid passwords", async () => {
    const login = new Login(repository, repository, passwords, clock, ids, {
      ttlSeconds: 3600,
      tokenFactory: () => "token"
    });

    await expect(
      login.execute({ email: "missing@example.com", password: "wrong-password" })
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      login.execute({ email: "admin@example.com", password: "wrong-password" })
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("loads and revokes a non-expired session", async () => {
    repository.sessions.push({
      id: "session-1",
      adminId: "admin-1",
      tokenHash: createHash("sha256").update("token").digest("hex"),
      csrfToken: "csrf",
      createdAt: clock.now(),
      expiresAt: new Date("2026-07-30T13:00:00.000Z"),
      revokedAt: null
    });

    const getSession = new GetSession(repository, repository, clock);
    const logout = new Logout(repository, clock);

    await expect(getSession.execute("token")).resolves.toMatchObject({
      admin: { email: "admin@example.com" },
      csrfToken: "csrf"
    });
    await logout.execute("token");
    await expect(getSession.execute("token")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
