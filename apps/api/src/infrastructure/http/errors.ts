import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: "VALIDATION_ERROR",
        message: "Please review the submitted data.",
        details: { issues: error.issues },
        requestId: request.id
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: request.id
      });
    }

    request.log.error({ err: error }, "request failed");
    return reply.status(500).send({
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
      requestId: request.id
    });
  });
}
