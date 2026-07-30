import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { loadEnvironment } from "../infrastructure/config/environment.js";
import { createDatabasePool } from "../infrastructure/database/client.js";
import { createQueueRedis } from "../infrastructure/redis/connections.js";
import { OutboxRelay } from "../infrastructure/queue/outbox-relay.js";
import { createEmbeddingQueuePolicy } from "../infrastructure/queue/config.js";
import { BullMqFaqPublisher } from "../modules/faq/adapters/outbound/bullmq-queue-publisher.js";
import { PostgresFaqRepository } from "../modules/faq/adapters/outbound/postgres-faq-repository.js";

export async function startOutboxRelay(): Promise<void> {
  const environment = loadEnvironment();
  const pool = createDatabasePool(environment.DATABASE_URL);
  const redis = createQueueRedis(environment.QUEUE_REDIS_URL);
  const publisher = new BullMqFaqPublisher(
    redis,
    createEmbeddingQueuePolicy({
      prefix: environment.QUEUE_PREFIX,
      attempts: environment.EMBEDDING_JOB_ATTEMPTS,
      backoffDelay: environment.EMBEDDING_BACKOFF_MS,
      backoffJitter: environment.EMBEDDING_BACKOFF_JITTER,
      workerConcurrency: environment.EMBEDDING_WORKER_CONCURRENCY,
      globalConcurrency: environment.EMBEDDING_GLOBAL_CONCURRENCY,
      rateLimitMax: environment.EMBEDDING_RATE_LIMIT_MAX,
      rateLimitDuration: environment.EMBEDDING_RATE_LIMIT_DURATION_MS
    })
  );
  const relay = new OutboxRelay(new PostgresFaqRepository(pool), publisher);
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    while (!abort.signal.aborted) {
      await relay.runOnce();
      await wait(1_000, undefined, { signal: abort.signal }).catch(() => undefined);
    }
  } finally {
    await Promise.allSettled([publisher.close(), redis.quit(), pool.end()]);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await startOutboxRelay();
}
