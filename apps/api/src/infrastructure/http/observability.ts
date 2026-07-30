import type { FastifyServerOptions } from "fastify";

export function observabilityOptions(): FastifyServerOptions {
  return {
    genReqId: () => crypto.randomUUID(),
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers.set-cookie",
          "password",
          "question",
          "answer",
          "OPENAI_API_KEY",
          "SESSION_SECRET"
        ],
        censor: "[REDACTED]"
      }
    }
  };
}
