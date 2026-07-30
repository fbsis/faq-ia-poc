import { describe, expect, it } from "vitest";
import { buildApplication } from "../../../src/bootstrap/build-application.js";
import {
  APPLICATION_METRIC_NAMES,
  MetricsRegistry
} from "../../../src/infrastructure/observability/metrics.js";
import { observabilityOptions } from "../../../src/infrastructure/http/observability.js";

describe("observability controls", () => {
  it("propagates safe correlation identifiers and records HTTP metrics", async () => {
    const app = await buildApplication({ mode: "test" });
    const requestId = "e2e-correlation-123";
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { "x-request-id": requestId }
    });

    expect(response.headers["x-request-id"]).toBe(requestId);
    expect(app.metrics.render()).toContain("faq_http_requests_total");
    expect(app.metrics.render()).not.toContain("/api/v1/health?");
    await app.close();
  });

  it("declares non-sensitive metrics for every operational boundary", () => {
    expect(APPLICATION_METRIC_NAMES).toEqual(
      expect.arrayContaining([
        "faq_http_requests_total",
        "faq_cache_operations_total",
        "faq_retrieval_score",
        "faq_openai_requests_total",
        "faq_outbox_messages",
        "faq_queue_jobs",
        "faq_knowledge_gaps"
      ])
    );

    const metrics = new MetricsRegistry();
    metrics.increment("faq_cache_operations_total", { outcome: "hit" });
    expect(metrics.render()).toContain('faq_cache_operations_total{outcome="hit"} 1');
  });

  it("redacts authentication, secrets, questions, and answers from structured logs", () => {
    const logger = observabilityOptions().logger;
    expect(logger).toMatchObject({
      redact: {
        censor: "[REDACTED]",
        paths: expect.arrayContaining([
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
          "req.body.question",
          "req.body.answer",
          "*.OPENAI_API_KEY",
          "*.SESSION_SECRET"
        ])
      }
    });
  });
});
