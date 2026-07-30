import type {
  EmbeddingJobPublisher,
  OutboxMessage,
  OutboxRepository
} from "../../modules/faq/application/ports.js";

export function faqEmbeddingJobId(payload: OutboxMessage["payload"]): string {
  return `faq-embedding-${payload.faqId}-v${payload.contentVersion}`;
}

export class OutboxRelay {
  private readonly completed = new Set<string>();

  constructor(
    private readonly outbox: Pick<OutboxRepository, "claim" | "markPublished">,
    private readonly publisher: EmbeddingJobPublisher
  ) {}

  async runOnce(limit = 50): Promise<number> {
    const messages = (await this.outbox.claim(limit)).filter(
      (message) => !this.completed.has(message.id)
    );
    const published: string[] = [];
    for (const message of messages) {
      await this.publisher.publish(message.payload, faqEmbeddingJobId(message.payload));
      published.push(message.id);
    }
    await this.outbox.markPublished(published);
    published.forEach((id) => this.completed.add(id));
    return published.length;
  }
}
