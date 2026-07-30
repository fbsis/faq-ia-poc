import {
  knowledgeGapDetailsSchema,
  knowledgeGapIdParamsSchema,
  knowledgeGapListQuerySchema,
  knowledgeGapPageSchema
} from "@faq/contracts";
import type { FastifyInstance } from "fastify";
import type { GetSession } from "../../../../auth/application/get-session.js";
import { createAuthGuards } from "../../../../auth/adapters/inbound/http/auth-plugin.js";
import type { GetKnowledgeGap } from "../../../application/get-knowledge-gap.js";
import type { ListKnowledgeGaps } from "../../../application/list-knowledge-gaps.js";

export function registerKnowledgeGapRoutes(
  app: FastifyInstance,
  dependencies: {
    getSession: GetSession;
    listKnowledgeGaps: ListKnowledgeGaps;
    getKnowledgeGap: GetKnowledgeGap;
  }
): void {
  const guards = createAuthGuards(dependencies.getSession);
  const requireAdmin = (request: Parameters<typeof guards.requireAdmin>[0]) =>
    guards.requireAdmin(request);

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
}
