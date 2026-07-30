import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../../../infrastructure/http/errors.js";
import type { GetSession } from "../../../application/get-session.js";

export const SESSION_COOKIE = "faq_admin_session";

export interface AuthGuards {
  requireAdmin(request: FastifyRequest): Promise<void>;
  requireCsrf(request: FastifyRequest): Promise<void>;
}

export function createAuthGuards(getSession: GetSession): AuthGuards {
  return {
    async requireAdmin(request) {
      await getSession.execute(request.cookies[SESSION_COOKIE]);
    },
    async requireCsrf(request) {
      const session = await getSession.execute(request.cookies[SESSION_COOKIE]);
      if (
        !request.headers["x-csrf-token"] ||
        request.headers["x-csrf-token"] !== session.csrfToken
      ) {
        throw new AppError("INVALID_CSRF_TOKEN", "The CSRF token is missing or invalid.", 403);
      }
    }
  };
}

export function setSessionCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api/v1",
    maxAge: 28_800
  });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/api/v1"
  });
}
