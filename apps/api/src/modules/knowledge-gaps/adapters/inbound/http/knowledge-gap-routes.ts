import {
  dismissKnowledgeGapInputSchema,
  gapResolutionSchema,
  idempotencyKeySchema,
  knowledgeGapDetailsSchema,
  knowledgeGapIdParamsSchema,
  knowledgeGapListQuerySchema,
  knowledgeGapPageSchema,
  knowledgeGapSchema,
  reopenKnowledgeGapInputSchema,
  retryGapResolutionInputSchema,
  resolveKnowledgeGapInputSchema
} from "@faq/contracts";
import type { FastifyInstance } from "fastify";
import type { GetSession } from "../../../../auth/application/get-session.js";
import {
  createAuthGuards,
  SESSION_COOKIE
} from "../../../../auth/adapters/inbound/http/auth-plugin.js";
import type { GetKnowledgeGap } from "../../../application/get-knowledge-gap.js";
import type { DismissKnowledgeGap } from "../../../application/dismiss-knowledge-gap.js";
import type { ListKnowledgeGaps } from "../../../application/list-knowledge-gaps.js";
import type { ReopenKnowledgeGap } from "../../../application/reopen-knowledge-gap.js";
import type { ResolveKnowledgeGap } from "../../../application/resolve-knowledge-gap.js";
import type { RetryGapResolution } from "../../../application/retry-gap-resolution.js";

export function registerKnowledgeGapRoutes(
  app: FastifyInstance,
  dependencies: {
    getSession: GetSession;
    listKnowledgeGaps: ListKnowledgeGaps;
    getKnowledgeGap: GetKnowledgeGap;
    resolveKnowledgeGap: ResolveKnowledgeGap;
    retryGapResolution: RetryGapResolution;
    dismissKnowledgeGap: DismissKnowledgeGap;
    reopenKnowledgeGap: ReopenKnowledgeGap;
  }
): void {
  const guards = createAuthGuards(dependencies.getSession);
  const requireAdmin = (request: Parameters<typeof guards.requireAdmin>[0]) =>
    guards.requireAdmin(request);
  const requireMutation = (request: Parameters<typeof guards.requireCsrf>[0]) =>
    guards.requireCsrf(request);

  app.get("/api/v1/knowledge-gaps", { preHandler: requireAdmin }, async (request) =>
    knowledgeGapPageSchema.parse(
      await dependencies.listKnowledgeGaps.execute(knowledgeGapListQuerySchema.parse(request.query))
    )
  );

  app.get(
    "/api/v1/knowledge-gaps/:knowledgeGapId",
    { preHandler: requireAdmin },
    async (request) => {
      const { knowledgeGapId } = knowledgeGapIdParamsSchema.parse(request.params);
      return knowledgeGapDetailsSchema.parse(
        await dependencies.getKnowledgeGap.execute(knowledgeGapId)
      );
    }
  );

  app.post(
    "/api/v1/knowledge-gaps/:knowledgeGapId/resolution-retries",
    { preHandler: requireMutation },
    async (request, reply) => {
      const { knowledgeGapId } = knowledgeGapIdParamsSchema.parse(request.params);
      const session = await dependencies.getSession.execute(request.cookies[SESSION_COOKIE]);
      const resolution = await dependencies.retryGapResolution.execute({
        knowledgeGapId,
        adminId: session.admin.id,
        idempotencyKey: idempotencyKeySchema.parse(request.headers["idempotency-key"]),
        input: retryGapResolutionInputSchema.parse(request.body)
      });
      return reply.status(202).send(gapResolutionSchema.parse(resolution));
    }
  );

  app.post(
    "/api/v1/knowledge-gaps/:knowledgeGapId/resolutions",
    { preHandler: requireMutation },
    async (request, reply) => {
      const { knowledgeGapId } = knowledgeGapIdParamsSchema.parse(request.params);
      const session = await dependencies.getSession.execute(request.cookies[SESSION_COOKIE]);
      const resolution = await dependencies.resolveKnowledgeGap.execute({
        knowledgeGapId,
        adminId: session.admin.id,
        idempotencyKey: idempotencyKeySchema.parse(request.headers["idempotency-key"]),
        input: resolveKnowledgeGapInputSchema.parse(request.body)
      });
      return reply.status(202).send(gapResolutionSchema.parse(resolution));
    }
  );

  app.post(
    "/api/v1/knowledge-gaps/:knowledgeGapId/dismiss",
    { preHandler: requireMutation },
    async (request) => {
      const { knowledgeGapId } = knowledgeGapIdParamsSchema.parse(request.params);
      const session = await dependencies.getSession.execute(request.cookies[SESSION_COOKIE]);
      return knowledgeGapSchema.parse(
        await dependencies.dismissKnowledgeGap.execute({
          knowledgeGapId,
          adminId: session.admin.id,
          idempotencyKey: idempotencyKeySchema.parse(request.headers["idempotency-key"]),
          input: dismissKnowledgeGapInputSchema.parse(request.body)
        })
      );
    }
  );

  app.post(
    "/api/v1/knowledge-gaps/:knowledgeGapId/reopen",
    { preHandler: requireMutation },
    async (request) => {
      const { knowledgeGapId } = knowledgeGapIdParamsSchema.parse(request.params);
      const session = await dependencies.getSession.execute(request.cookies[SESSION_COOKIE]);
      return knowledgeGapSchema.parse(
        await dependencies.reopenKnowledgeGap.execute({
          knowledgeGapId,
          adminId: session.admin.id,
          idempotencyKey: idempotencyKeySchema.parse(request.headers["idempotency-key"]),
          input: reopenKnowledgeGapInputSchema.parse(request.body)
        })
      );
    }
  );
}
