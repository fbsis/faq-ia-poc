import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import {
  createEmbeddingQueuePolicy,
  type EmbeddingQueuePolicy,
  FAQ_EMBEDDINGS_QUEUE
} from "../../../../infrastructure/queue/config.js";
import type { EmbeddingJobPublisher, OutboxMessage } from "../../application/ports.js";

export class BullMqFaqPublisher implements EmbeddingJobPublisher {
  private readonly queue: Queue;

  constructor(
    connection: Redis,
    private readonly policy: EmbeddingQueuePolicy = createEmbeddingQueuePolicy()
  ) {
    this.queue = new Queue(FAQ_EMBEDDINGS_QUEUE, {
      connection,
      prefix: policy.prefix
    });
  }

  async publish(payload: OutboxMessage["payload"], jobId: string): Promise<void> {
    await this.queue.add("prepare-faq-embedding", payload, {
      ...this.policy.jobOptions,
      jobId
    });
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}
