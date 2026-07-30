import { fileURLToPath } from "node:url";
import { Queue, Worker } from "bullmq";
import { loadEnvironment } from "../infrastructure/config/environment.js";
import { createDatabasePool } from "../infrastructure/database/client.js";
import { createQueueRedis } from "../infrastructure/redis/connections.js";
import {
  applyEmbeddingQueuePolicy,
  createEmbeddingQueuePolicy,
  FAQ_EMBEDDINGS_QUEUE,
  shutdownEmbeddingWorker
} from "../infrastructure/queue/config.js";
import { parsePrepareFaqEmbeddingJob } from "../infrastructure/queue/job-contracts.js";
import { processFaqEmbedding } from "../infrastructure/queue/process-faq-embedding.js";
import { DeterministicEmbeddingProvider } from "../modules/chat/adapters/outbound/deterministic-embedding-provider.js";
import { OpenAiEmbeddingProvider } from "../modules/chat/adapters/outbound/openai-embedding-provider.js";
import { PostgresFaqRepository } from "../modules/faq/adapters/outbound/postgres-faq-repository.js";

export async function startEmbeddingWorker(): Promise<void> {
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.DATABASE_URL);
  const redis = createQueueRedis(environment.QUEUE_REDIS_URL);
  const repository = new PostgresFaqRepository(pool);
  const policy = createEmbeddingQueuePolicy({
    prefix: environment.QUEUE_PREFIX,
    attempts: environment.EMBEDDING_JOB_ATTEMPTS,
    backoffDelay: environment.EMBEDDING_BACKOFF_MS,
    backoffJitter: environment.EMBEDDING_BACKOFF_JITTER,
    workerConcurrency: environment.EMBEDDING_WORKER_CONCURRENCY,
    globalConcurrency: environment.EMBEDDING_GLOBAL_CONCURRENCY,
    rateLimitMax: environment.EMBEDDING_RATE_LIMIT_MAX,
    rateLimitDuration: environment.EMBEDDING_RATE_LIMIT_DURATION_MS
  });
  const queue = new Queue(FAQ_EMBEDDINGS_QUEUE, {
    connection: redis,
    prefix: policy.prefix
  });
  await applyEmbeddingQueuePolicy(queue, policy);
  const embeddings =
    environment.EMBEDDING_PROVIDER === "openai"
      ? new OpenAiEmbeddingProvider(environment.OPENAI_API_KEY!, environment.OPENAI_EMBEDDING_MODEL)
      : new DeterministicEmbeddingProvider();
  const worker = new Worker(
    FAQ_EMBEDDINGS_QUEUE,
    async (job) => {
      await processFaqEmbedding(parsePrepareFaqEmbeddingJob(job.data), repository, embeddings);
    },
    { connection: redis, prefix: policy.prefix, ...policy.workerOptions }
  );
  worker.on("failed", (job, error) => {
    console.error("FAQ embedding job failed", { jobId: job?.id, message: error.message });
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      const payload = parsePrepareFaqEmbeddingJob(job.data);
      void repository.failEmbedding(
        payload.faqId,
        payload.contentVersion,
        error.message,
        payload.resolutionId
      );
    }
  });
  let stopping: Promise<void> | undefined;
  const stop = () => (stopping ??= shutdownEmbeddingWorker({ worker, queue, redis, pool }));
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
  await worker.waitUntilReady();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startEmbeddingWorker();
}
