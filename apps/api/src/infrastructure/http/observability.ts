import type { FastifyServerOptions } from "fastify";

export function observabilityOptions(): FastifyServerOptions {
  return {
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];
      return typeof incoming === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming)
        ? incoming
        : crypto.randomUUID();
    },
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers.set-cookie",
          "req.body.password",
          "req.body.question",
          "req.body.answer",
          "password",
          "question",
          "answer",
          "*.OPENAI_API_KEY",
          "*.SESSION_SECRET"
        ],
        censor: "[REDACTED]"
      }
    }
  };
}
