import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { DatabasePool } from "../infrastructure/database/client.js";
import { createDatabasePool } from "../infrastructure/database/client.js";
import { loadEnvironment, type Environment } from "../infrastructure/config/environment.js";
import { registerErrorHandler } from "../infrastructure/http/errors.js";
import { observabilityOptions } from "../infrastructure/http/observability.js";
import { createCacheRedis, createQueueRedis } from "../infrastructure/redis/connections.js";
import { GetSession } from "../modules/auth/application/get-session.js";
import { Login } from "../modules/auth/application/login.js";
import { Logout } from "../modules/auth/application/logout.js";
import type { AdminRepository, SessionRepository } from "../modules/auth/application/ports.js";
import { registerAuthRoutes } from "../modules/auth/adapters/inbound/http/auth-routes.js";
import { ScryptPasswordHasher } from "../modules/auth/adapters/outbound/password-hasher.js";
import { PostgresAuthRepository } from "../modules/auth/adapters/outbound/postgres-auth-repository.js";
import type { Admin, AdminSession } from "../modules/auth/domain/admin.js";
import { randomIds, systemClock } from "../shared/domain/ports.js";

export interface BuildApplicationOptions {
  mode?: "test" | "runtime";
  environment?: Environment;
}

export type Application = FastifyInstance & { environment: Environment };

export async function buildApplication(
  options: BuildApplicationOptions = {}
): Promise<Application> {
  const environment =
    options.environment ??
    loadEnvironment(
      options.mode === "test"
        ? {
            ...process.env,
            NODE_ENV: "test",
            ADMIN_EMAIL: "admin@example.com",
            ADMIN_PASSWORD: "change-this-password"
          }
        : process.env
    );
  const app = Fastify(observabilityOptions()) as unknown as Application;
  app.environment = environment;

  await app.register(cookie, { secret: environment.SESSION_SECRET });
  await app.register(cors, {
    origin: environment.NODE_ENV === "production" ? false : true,
    credentials: true
  });
  await app.register(rateLimit, { global: false });
  registerErrorHandler(app);

  const resources =
    options.mode === "test"
      ? await createTestResources(environment)
      : createRuntimeResources(environment);

  const login = new Login(
    resources.auth,
    resources.auth,
    resources.passwords,
    systemClock,
    randomIds,
    { ttlSeconds: environment.SESSION_TTL_SECONDS }
  );
  const getSession = new GetSession(resources.auth, resources.auth, systemClock);
  const logout = new Logout(resources.auth, systemClock);

  registerAuthRoutes(app, { environment, login, getSession, logout });
  app.get("/api/v1/health", () => ({ status: "ok" }));

  app.addHook("onClose", async () => {
    await Promise.allSettled([
      resources.pool?.end(),
      resources.cache?.quit(),
      resources.queue?.quit()
    ]);
  });

  return app;
}

interface Resources {
  auth: AdminRepository & SessionRepository;
  passwords: ScryptPasswordHasher;
  pool?: DatabasePool;
  cache?: Redis;
  queue?: Redis;
}

function createRuntimeResources(environment: Environment): Resources {
  const pool = createDatabasePool(environment.DATABASE_URL);
  return {
    auth: new PostgresAuthRepository(pool),
    passwords: new ScryptPasswordHasher(),
    pool,
    cache: createCacheRedis(environment.CACHE_REDIS_URL),
    queue: createQueueRedis(environment.QUEUE_REDIS_URL)
  };
}

async function createTestResources(environment: Environment): Promise<Resources> {
  const passwords = new ScryptPasswordHasher();
  const admin: Admin = {
    id: "00000000-0000-4000-8000-000000000001",
    email: environment.ADMIN_EMAIL,
    displayName: "FAQ Admin",
    passwordHash: await passwords.hash(environment.ADMIN_PASSWORD),
    active: true
  };
  return { auth: new MemoryAuthRepository(admin), passwords };
}

class MemoryAuthRepository implements AdminRepository, SessionRepository {
  private readonly sessions = new Map<string, AdminSession>();

  constructor(private readonly admin: Admin) {}

  findAdminByEmail(email: string): Promise<Admin | null> {
    return Promise.resolve(email === this.admin.email ? this.admin : null);
  }

  findAdminById(id: string): Promise<Admin | null> {
    return Promise.resolve(id === this.admin.id ? this.admin : null);
  }

  createSession(session: AdminSession): Promise<void> {
    this.sessions.set(session.tokenHash, session);
    return Promise.resolve();
  }

  findSessionByTokenHash(tokenHash: string, now: Date): Promise<AdminSession | null> {
    const session = this.sessions.get(tokenHash);
    return Promise.resolve(
      session && !session.revokedAt && session.expiresAt.getTime() > now.getTime() ? session : null
    );
  }

  revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session) session.revokedAt = revokedAt;
    return Promise.resolve();
  }
}
