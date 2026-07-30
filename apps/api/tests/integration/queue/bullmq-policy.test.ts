import { describe, expect, it, vi } from "vitest";
import {
  applyEmbeddingQueuePolicy,
  createEmbeddingQueuePolicy,
  shutdownEmbeddingWorker
} from "../../../src/infrastructure/queue/config.js";

describe("BullMQ embedding policy", () => {
  it("builds configurable retry, jitter, retention, concurrency, and rate-limit settings", () => {
    const policy = createEmbeddingQueuePolicy({
      prefix: "faq:test",
      attempts: 7,
      backoffDelay: 3_000,
      backoffJitter: 0.35,
      workerConcurrency: 4,
      globalConcurrency: 8,
      rateLimitMax: 30,
      rateLimitDuration: 45_000,
      completedRetentionAge: 86_400,
      completedRetentionCount: 100,
      failedRetentionAge: 172_800,
      failedRetentionCount: 200
    });

    expect(policy).toEqual({
      prefix: "faq:test",
      jobOptions: {
        attempts: 7,
        backoff: { type: "exponential", delay: 3_000, jitter: 0.35 },
        removeOnComplete: { age: 86_400, count: 100 },
        removeOnFail: { age: 172_800, count: 200 }
      },
      workerOptions: {
        concurrency: 4,
        limiter: { max: 30, duration: 45_000 }
      },
      globalConcurrency: 8,
      globalRateLimit: { max: 30, duration: 45_000 }
    });
  });

  it("applies global controls once and closes worker resources gracefully", async () => {
    const queue = {
      setGlobalConcurrency: vi.fn(async () => undefined),
      setGlobalRateLimit: vi.fn(async () => undefined)
    };
    const policy = createEmbeddingQueuePolicy();

    await applyEmbeddingQueuePolicy(queue, policy);

    expect(queue.setGlobalConcurrency).toHaveBeenCalledWith(10);
    expect(queue.setGlobalRateLimit).toHaveBeenCalledWith(60, 60_000);

    const order: string[] = [];
    await shutdownEmbeddingWorker({
      worker: { close: async () => void order.push("worker") },
      queue: { close: async () => void order.push("queue") },
      redis: { quit: async () => void order.push("redis") },
      pool: { end: async () => void order.push("pool") }
    });
    expect(order[0]).toBe("worker");
    expect(order.slice(1).sort()).toEqual(["pool", "queue", "redis"]);
  });
});
