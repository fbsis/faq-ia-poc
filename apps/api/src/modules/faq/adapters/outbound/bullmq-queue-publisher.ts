import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import {
  embeddingJobOptions,
  FAQ_EMBEDDINGS_QUEUE
} from "../../../../infrastructure/queue/config.js";
import type { EmbeddingJobPublisher, OutboxMessage } from "../../application/ports.js";

export class BullMqFaqPublisher implements EmbeddingJobPublisher {
  private readonly queue: Queue;

  constructor(connection: Redis) {
    this.queue = new Queue(FAQ_EMBEDDINGS_QUEUE, { connection });
  }

  async publish(payload: OutboxMessage["payload"], jobId: string): Promise<void> {
    await this.queue.add("prepare-faq-embedding", payload, {
      ...embeddingJobOptions,
      jobId
    });
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}
