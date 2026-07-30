import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Environment } from "../../../../../infrastructure/config/environment.js";
import type { GetSession } from "../../../application/get-session.js";
import type { Login } from "../../../application/login.js";
import type { Logout } from "../../../application/logout.js";
import {
  clearSessionCookie,
  createAuthGuards,
  SESSION_COOKIE,
  setSessionCookie
} from "./auth-plugin.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200)
});

export interface AuthRouteDependencies {
  environment: Environment;
  login: Login;
  getSession: GetSession;
  logout: Logout;
}

export function registerAuthRoutes(
  app: FastifyInstance,
  dependencies: AuthRouteDependencies
): void {
  const guards = createAuthGuards(dependencies.getSession);

  app.post(
    "/api/v1/auth/login",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } }
    },
    async (request, reply) => {
      const credentials = loginSchema.parse(request.body);
      const result = await dependencies.login.execute(credentials);
      setSessionCookie(reply, result.token, dependencies.environment.NODE_ENV === "production");
      return reply.header("x-csrf-token", result.csrfToken).status(204).send();
    }
  );

  app.get(
    "/api/v1/auth/session",
    { preHandler: (request) => guards.requireAdmin(request) },
    async (request) => dependencies.getSession.execute(request.cookies[SESSION_COOKIE])
  );

  app.post(
    "/api/v1/auth/logout",
    { preHandler: (request) => guards.requireCsrf(request) },
    async (request, reply) => {
      await dependencies.logout.execute(request.cookies[SESSION_COOKIE]);
      clearSessionCookie(reply, dependencies.environment.NODE_ENV === "production");
      return reply.status(204).send();
    }
  );
}
