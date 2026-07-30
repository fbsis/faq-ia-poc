import { analyticsRequestSchema, analyticsSummarySchema } from "@faq/contracts";
import type { FastifyInstance } from "fastify";
import type { GetSession } from "../../../../auth/application/get-session.js";
import { createAuthGuards } from "../../../../auth/adapters/inbound/http/auth-plugin.js";
import type { GetAnalyticsSummary } from "../../../application/get-analytics-summary.js";

export function registerAnalyticsRoutes(
  app: FastifyInstance,
  dependencies: {
    getSession: GetSession;
    getAnalyticsSummary: GetAnalyticsSummary;
  }
): void {
  const guards = createAuthGuards(dependencies.getSession);
  app.get(
    "/api/v1/analytics/summary",
    { preHandler: (request) => guards.requireAdmin(request) },
    async (request) => {
      const range = analyticsRequestSchema.parse(request.query);
      return analyticsSummarySchema.parse(await dependencies.getAnalyticsSummary.execute(range));
    }
  );
}
