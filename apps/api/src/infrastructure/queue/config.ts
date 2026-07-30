import { z } from "zod";

export const FAQ_EMBEDDINGS_QUEUE = "faq-embeddings";

export const prepareFaqEmbeddingSchema = z.object({
  faqId: z.string().uuid(),
  contentVersion: z.number().int().positive(),
  resolutionId: z.string().uuid().optional()
});

export interface EmbeddingQueuePolicyInput {
  prefix?: string;
  attempts?: number;
  backoffDelay?: number;
  backoffJitter?: number;
  workerConcurrency?: number;
  globalConcurrency?: number;
  rateLimitMax?: number;
  rateLimitDuration?: number;
  completedRetentionAge?: number;
  completedRetentionCount?: number;
  failedRetentionAge?: number;
  failedRetentionCount?: number;
}

export function createEmbeddingQueuePolicy(input: EmbeddingQueuePolicyInput = {}) {
  const rateLimitMax = input.rateLimitMax ?? 60;
  const rateLimitDuration = input.rateLimitDuration ?? 60_000;
  return {
    prefix: input.prefix ?? "faq",
    jobOptions: {
      attempts: input.attempts ?? 5,
      backoff: {
        type: "exponential" as const,
        delay: input.backoffDelay ?? 2_000,
        jitter: input.backoffJitter ?? 0.2
      },
      removeOnComplete: {
        age: input.completedRetentionAge ?? 7 * 24 * 60 * 60,
        count: input.completedRetentionCount ?? 1_000
      },
      removeOnFail: {
        age: input.failedRetentionAge ?? 30 * 24 * 60 * 60,
        count: input.failedRetentionCount ?? 5_000
      }
    },
    workerOptions: {
      concurrency: input.workerConcurrency ?? 5,
      limiter: { max: rateLimitMax, duration: rateLimitDuration }
    },
    globalConcurrency: input.globalConcurrency ?? 10,
    globalRateLimit: { max: rateLimitMax, duration: rateLimitDuration }
  };
}

export type EmbeddingQueuePolicy = ReturnType<typeof createEmbeddingQueuePolicy>;

export async function applyEmbeddingQueuePolicy(
  queue: {
    setGlobalConcurrency(value: number): Promise<unknown>;
    setGlobalRateLimit(max: number, duration: number): Promise<unknown>;
  },
  policy: EmbeddingQueuePolicy
): Promise<void> {
  await Promise.all([
    queue.setGlobalConcurrency(policy.globalConcurrency),
    queue.setGlobalRateLimit(policy.globalRateLimit.max, policy.globalRateLimit.duration)
  ]);
}

export async function shutdownEmbeddingWorker(resources: {
  worker: { close(): Promise<unknown> };
  queue: { close(): Promise<unknown> };
  redis: { quit(): Promise<unknown> };
  pool: { end(): Promise<unknown> };
}): Promise<void> {
  await resources.worker.close();
  await Promise.allSettled([
    resources.queue.close(),
    resources.redis.quit(),
    resources.pool.end()
  ]);
}

const defaults = createEmbeddingQueuePolicy();
export const embeddingJobOptions = defaults.jobOptions;
export const embeddingWorkerPolicy = defaults.workerOptions;
