import { prepareFaqEmbeddingSchema } from "./config.js";

export type PrepareFaqEmbeddingJob = ReturnType<typeof prepareFaqEmbeddingSchema.parse>;

export function parsePrepareFaqEmbeddingJob(value: unknown): PrepareFaqEmbeddingJob {
  return prepareFaqEmbeddingSchema.parse(value);
}
