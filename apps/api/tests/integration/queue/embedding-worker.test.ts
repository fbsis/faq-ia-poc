import { describe, expect, it } from "vitest";
import { processFaqEmbedding } from "../../../src/infrastructure/queue/process-faq-embedding.js";

describe("FAQ embedding processor", () => {
  it("activates the current content version and ignores a stale job", async () => {
    const activated: number[] = [];
    const repository = {
      getEmbeddingContent: async () => ({
        faqId: "00000000-0000-4000-8000-000000000002",
        contentVersion: 2,
        text: "Pergunta\nResposta"
      }),
      activateEmbedding: async (_id: string, version: number) => activated.push(version),
      failEmbedding: async () => undefined
    };

    await processFaqEmbedding(
      { faqId: "00000000-0000-4000-8000-000000000002", contentVersion: 1 },
      repository,
      { embed: async () => [1, 0] }
    );
    await processFaqEmbedding(
      { faqId: "00000000-0000-4000-8000-000000000002", contentVersion: 2 },
      repository,
      { embed: async () => [1, 0] }
    );

    expect(activated).toEqual([2]);
  });

  it("records permanent failures but rethrows transient failures for BullMQ retry", async () => {
    const failures: string[] = [];
    const repository = {
      getEmbeddingContent: async () => ({
        faqId: "00000000-0000-4000-8000-000000000002",
        contentVersion: 1,
        text: "Pergunta\nResposta"
      }),
      activateEmbedding: async () => undefined,
      failEmbedding: async (_id: string, _version: number, message: string) =>
        failures.push(message)
    };

    await expect(
      processFaqEmbedding(
        { faqId: "00000000-0000-4000-8000-000000000002", contentVersion: 1 },
        repository,
        {
          embed: async () => {
            throw Object.assign(new Error("timeout"), { transient: true });
          }
        }
      )
    ).rejects.toThrow("timeout");
    await processFaqEmbedding(
      { faqId: "00000000-0000-4000-8000-000000000002", contentVersion: 1 },
      repository,
      {
        embed: async () => {
          throw new Error("invalid input");
        }
      }
    );
    expect(failures).toEqual(["invalid input"]);
  });

  it("forwards the resolution identifier so activation can close its knowledge gap", async () => {
    const activations: Array<{ faqId: string; version: number; resolutionId?: string }> = [];
    const repository = {
      getEmbeddingContent: async () => ({
        faqId: "00000000-0000-4000-8000-000000000002",
        contentVersion: 1,
        text: "Pergunta\nResposta"
      }),
      activateEmbedding: async (
        faqId: string,
        version: number,
        _embedding: number[],
        resolutionId?: string
      ) => {
        activations.push({ faqId, version, resolutionId });
      },
      failEmbedding: async () => undefined
    };

    await processFaqEmbedding(
      {
        faqId: "00000000-0000-4000-8000-000000000002",
        contentVersion: 1,
        resolutionId: "00000000-0000-4000-8000-000000000003"
      },
      repository,
      { embed: async () => [1, 0] }
    );

    expect(activations).toEqual([
      {
        faqId: "00000000-0000-4000-8000-000000000002",
        version: 1,
        resolutionId: "00000000-0000-4000-8000-000000000003"
      }
    ]);
  });
});
