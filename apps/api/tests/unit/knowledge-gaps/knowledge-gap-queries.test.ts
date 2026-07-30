import type {
  KnowledgeGapDetails,
  KnowledgeGapListQuery,
  KnowledgeGapPage
} from "@faq/contracts";
import { describe, expect, it } from "vitest";
import { GetKnowledgeGap } from "../../../src/modules/knowledge-gaps/application/get-knowledge-gap.js";
import { ListKnowledgeGaps } from "../../../src/modules/knowledge-gaps/application/list-knowledge-gaps.js";
import type { KnowledgeGapRepository } from "../../../src/modules/knowledge-gaps/application/ports.js";

const page: KnowledgeGapPage = {
  items: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      representativeQuestion: "Como emitir a segunda via?",
      status: "open",
      occurrenceCount: 2,
      firstOccurredAt: "2026-07-29T12:00:00.000Z",
      lastOccurredAt: "2026-07-30T12:00:00.000Z",
      version: 2,
      createdAt: "2026-07-29T12:00:00.000Z",
      updatedAt: "2026-07-30T12:00:00.000Z"
    }
  ],
  page: 1,
  pageSize: 20,
  total: 1
};

const details: KnowledgeGapDetails = {
  ...page.items[0]!,
  occurrences: [],
  events: []
};

class RepositoryFake implements KnowledgeGapRepository {
  query: KnowledgeGapListQuery | null = null;
  details: KnowledgeGapDetails | null = details;

  list(query: KnowledgeGapListQuery): Promise<KnowledgeGapPage> {
    this.query = query;
    return Promise.resolve(page);
  }

  get(): Promise<KnowledgeGapDetails | null> {
    return Promise.resolve(this.details);
  }
}

describe("knowledge gap queries", () => {
  it("passes validated inbox filters to the repository", async () => {
    const repository = new RepositoryFake();
    const useCase = new ListKnowledgeGaps(repository);
    const query: KnowledgeGapListQuery = {
      page: 1,
      pageSize: 20,
      status: "open",
      sort: "occurrences_desc"
    };

    await expect(useCase.execute(query)).resolves.toEqual(page);
    expect(repository.query).toEqual(query);
  });

  it("returns occurrence and event details", async () => {
    const repository = new RepositoryFake();
    await expect(
      new GetKnowledgeGap(repository).execute("00000000-0000-4000-8000-000000000101")
    ).resolves.toEqual(details);
  });

  it("returns a stable not-found error for a missing gap", async () => {
    const repository = new RepositoryFake();
    repository.details = null;

    await expect(
      new GetKnowledgeGap(repository).execute("00000000-0000-4000-8000-000000000999")
    ).rejects.toMatchObject({ code: "KNOWLEDGE_GAP_NOT_FOUND", statusCode: 404 });
  });
});
