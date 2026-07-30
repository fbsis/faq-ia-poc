import type { FastifyInstance } from "fastify";
import { createAuthGuards } from "../../modules/auth/adapters/inbound/http/auth-plugin.js";
import type { GetSession } from "../../modules/auth/application/get-session.js";

export const APPLICATION_METRIC_NAMES = [
  "faq_http_requests_total",
  "faq_http_request_duration_seconds",
  "faq_chat_outcomes_total",
  "faq_cache_operations_total",
  "faq_retrieval_score",
  "faq_openai_requests_total",
  "faq_openai_request_duration_seconds",
  "faq_outbox_messages",
  "faq_outbox_publish_attempts_total",
  "faq_queue_jobs",
  "faq_queue_processing_duration_seconds",
  "faq_knowledge_gaps",
  "faq_gap_resolutions_total"
] as const;

type MetricName = (typeof APPLICATION_METRIC_NAMES)[number];
type Labels = Readonly<Record<string, string | number>>;

export class MetricsRegistry {
  private readonly values = new Map<string, { name: MetricName; labels: Labels; value: number }>();

  increment(name: MetricName, labels: Labels = {}, amount = 1): void {
    this.update(name, labels, amount);
  }

  observe(name: MetricName, value: number, labels: Labels = {}): void {
    this.update(name, { ...labels, statistic: "sum" }, value);
    this.update(name, { ...labels, statistic: "count" }, 1);
  }

  render(): string {
    return [...this.values.values()]
      .sort((left, right) =>
        metricKey(left.name, left.labels).localeCompare(metricKey(right.name, right.labels))
      )
      .map(({ name, labels, value }) => `${name}${renderLabels(labels)} ${value}`)
      .join("\n")
      .concat("\n");
  }

  private update(name: MetricName, labels: Labels, amount: number): void {
    const key = metricKey(name, labels);
    const current = this.values.get(key);
    this.values.set(key, { name, labels, value: (current?.value ?? 0) + amount });
  }
}

export function registerHttpMetrics(app: FastifyInstance, metrics: MetricsRegistry): void {
  app.addHook("onResponse", (request, reply, done) => {
    const labels = {
      method: request.method,
      route: request.routeOptions.url ?? "unmatched",
      status: reply.statusCode
    };
    metrics.increment("faq_http_requests_total", labels);
    metrics.observe("faq_http_request_duration_seconds", reply.elapsedTime / 1_000, labels);
    done();
  });
}

export function registerMetricsRoute(
  app: FastifyInstance,
  dependencies: { getSession: GetSession; metrics: MetricsRegistry }
): void {
  const guards = createAuthGuards(dependencies.getSession);
  app.get(
    "/api/v1/metrics",
    { preHandler: (request) => guards.requireAdmin(request) },
    async (_, reply) =>
      reply.type("text/plain; version=0.0.4; charset=utf-8").send(dependencies.metrics.render())
  );
}

function metricKey(name: MetricName, labels: Labels): string {
  return `${name}${renderLabels(labels)}`;
}

function renderLabels(labels: Labels): string {
  const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) return "";
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(String(value))}"`).join(",")}}`;
}

function escapeLabel(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}
