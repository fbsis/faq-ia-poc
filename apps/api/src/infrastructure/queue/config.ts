import { z } from "zod";

export const FAQ_EMBEDDINGS_QUEUE = "faq-embeddings";

export const prepareFaqEmbeddingSchema = z.object({
  faqId: z.string().uuid(),
  contentVersion: z.number().int().positive(),
  resolutionId: z.string().uuid().optional()
});

export const embeddingJobOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: { age: 7 * 24 * 60 * 60, count: 1_000 },
  removeOnFail: { age: 30 * 24 * 60 * 60, count: 5_000 }
} as const;

export const embeddingWorkerPolicy = {
  concurrency: 5,
  limiter: { max: 60, duration: 60_000 }
} as const;
