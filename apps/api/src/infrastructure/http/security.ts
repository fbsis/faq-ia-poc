import type { FastifyInstance } from "fastify";
import type { Environment } from "../config/environment.js";

export function registerSecurityHeaders(app: FastifyInstance, environment: Environment): void {
  app.addHook("onSend", (request, reply, _payload, done) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "camera=(), microphone=(), geolocation=()");
    reply.header("x-request-id", request.id);
    if (request.url.startsWith("/api/")) {
      reply.header("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
      reply.header("cache-control", "no-store");
    }
    if (environment.NODE_ENV === "production") {
      reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
    }
    done();
  });
}
