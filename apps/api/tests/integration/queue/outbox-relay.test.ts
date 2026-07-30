import { describe, expect, it } from "vitest";
import { faqEmbeddingJobId, OutboxRelay } from "../../../src/infrastructure/queue/outbox-relay.js";

describe("OutboxRelay", () => {
  it("uses deterministic BullMQ IDs and marks duplicate publications complete", async () => {
    const messages = [
      {
        id: "00000000-0000-4000-8000-000000000003",
        payload: {
          faqId: "00000000-0000-4000-8000-000000000002",
          contentVersion: 4
        }
      }
    ];
    const published: string[] = [];
    const completed: string[] = [];
    const relay = new OutboxRelay(
      {
        claim: async () => messages,
        markPublished: async (ids) => completed.push(...ids)
      },
      {
        publish: async (_, jobId) => published.push(jobId)
      }
    );

    await relay.runOnce();
    await relay.runOnce();

    expect(published).toEqual(["faq-embedding-00000000-0000-4000-8000-000000000002-v4"]);
    expect(completed).toEqual([messages[0]!.id]);
    expect(faqEmbeddingJobId(messages[0]!.payload)).toBe(published[0]);
  });
});
