import { describe, expect, it } from "vitest";
import type { FaqListQuery, FaqPage } from "@faq/contracts";
import { createFaqUseCases } from "../../../src/modules/faq/application/faq-use-cases.js";
import type {
  CategoryRepository,
  FaqRepository
} from "../../../src/modules/faq/application/ports.js";
import type { Category } from "../../../src/modules/faq/domain/category.js";
import type { FaqEntry } from "../../../src/modules/faq/domain/faq-entry.js";

describe("FAQ use cases", () => {
  it("creates categories and queues FAQ content changes", async () => {
    const repository = new MemoryFaqRepository();
    const useCases = createFaqUseCases({
      categories: repository,
      faqs: repository,
      ids: { create: () => "00000000-0000-4000-8000-000000000002" },
      clock: { now: () => new Date("2026-07-30T12:00:00.000Z") }
    });
    const category = await useCases.createCategory({ name: "Conta" });
    const faq = await useCases.createFaq({
      categoryId: category.id,
      question: "Como redefino minha senha?",
      aliases: [],
      answer: "Use o link enviado por e-mail."
    });

    expect(faq.status).toBe("embedding_pending");
    expect(repository.queuedVersions).toEqual([1]);
  });

  it("deactivates without deletion and restores through re-embedding", async () => {
    const repository = new MemoryFaqRepository();
    const useCases = createFaqUseCases({
      categories: repository,
      faqs: repository,
      ids: { create: () => "00000000-0000-4000-8000-000000000002" },
      clock: { now: () => new Date() }
    });
    const category = await useCases.createCategory({ name: "Conta" });
    const faq = await useCases.createFaq({
      categoryId: category.id,
      question: "Como redefino minha senha?",
      aliases: [],
      answer: "Use o link enviado por e-mail."
    });

    expect((await useCases.changeStatus(faq.id, false)).status).toBe("inactive");
    expect(await useCases.getFaq(faq.id)).not.toBeNull();
    expect((await useCases.changeStatus(faq.id, true)).status).toBe("embedding_pending");
    expect(repository.queuedVersions).toEqual([1, 2]);
  });

  it("allows retry only after an embedding failure", async () => {
    const repository = new MemoryFaqRepository();
    const useCases = createFaqUseCases({
      categories: repository,
      faqs: repository,
      ids: { create: () => "00000000-0000-4000-8000-000000000002" },
      clock: { now: () => new Date() }
    });
    await expect(useCases.retryEmbedding("00000000-0000-4000-8000-000000000099")).rejects.toThrow();
  });
});

class MemoryFaqRepository implements CategoryRepository, FaqRepository {
  categories: Category[] = [];
  faqs: FaqEntry[] = [];
  queuedVersions: number[] = [];

  listCategories = async () => this.categories;
  createCategory = async (category: Category) => {
    const stored: Category = {
      ...category,
      id: "00000000-0000-4000-8000-000000000001"
    };
    this.categories.push(stored);
    return stored;
  };
  listFaqs = async (query: FaqListQuery): Promise<FaqPage> => ({
    items: this.faqs.map((faq) => ({
      id: faq.id,
      category: {
        id: faq.categoryId,
        name: this.categories.find((item) => item.id === faq.categoryId)?.name ?? "Conta"
      },
      question: faq.question,
      aliases: faq.aliases,
      answer: faq.answer,
      status: faq.status,
      contentVersion: faq.contentVersion,
      embeddingError: faq.embeddingError,
      createdAt: faq.createdAt.toISOString(),
      updatedAt: faq.updatedAt.toISOString()
    })),
    page: query.page,
    pageSize: query.pageSize,
    total: this.faqs.length
  });
  getFaq = async (id: string) => this.faqs.find((faq) => faq.id === id) ?? null;
  saveFaq = async (faq: FaqEntry, queueEmbedding: boolean) => {
    this.faqs = [...this.faqs.filter((item) => item.id !== faq.id), faq];
    if (queueEmbedding) this.queuedVersions.push(faq.contentVersion);
    return faq;
  };
  incrementKnowledgeVersion = async () => undefined;
}
