import type { FaqListQuery } from "@faq/contracts";
import type { CategoryRepository, FaqRepository } from "../../src/modules/faq/application/ports.js";
import type { Category } from "../../src/modules/faq/domain/category.js";
import type { FaqEntry } from "../../src/modules/faq/domain/faq-entry.js";

export class MemoryFaqRepository implements CategoryRepository, FaqRepository {
  private readonly categories: Category[] = [];
  private readonly faqs: FaqEntry[] = [];

  listCategories(): Promise<Category[]> {
    return Promise.resolve([...this.categories]);
  }

  createCategory(category: Category): Promise<Category> {
    this.categories.push(category);
    return Promise.resolve(category);
  }

  listFaqs(query: FaqListQuery) {
    const items = this.faqs
      .filter((faq) => !query.status || faq.status === query.status)
      .filter((faq) => !query.categoryId || faq.categoryId === query.categoryId)
      .map((faq) => {
        const category = this.categories.find((item) => item.id === faq.categoryId)!;
        return {
          id: faq.id,
          category: { id: category.id, name: category.name },
          question: faq.question,
          aliases: faq.aliases,
          answer: faq.answer,
          status: faq.status,
          contentVersion: faq.contentVersion,
          embeddingError: faq.embeddingError,
          createdAt: faq.createdAt.toISOString(),
          updatedAt: faq.updatedAt.toISOString()
        };
      });
    const offset = (query.page - 1) * query.pageSize;
    return Promise.resolve({
      items: items.slice(offset, offset + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: items.length
    });
  }

  getFaq(id: string): Promise<FaqEntry | null> {
    return Promise.resolve(this.faqs.find((faq) => faq.id === id) ?? null);
  }

  saveFaq(faq: FaqEntry): Promise<FaqEntry> {
    const index = this.faqs.findIndex((item) => item.id === faq.id);
    if (index >= 0) this.faqs[index] = faq;
    else this.faqs.push(faq);
    return Promise.resolve(faq);
  }

  incrementKnowledgeVersion(): Promise<void> {
    return Promise.resolve();
  }
}
