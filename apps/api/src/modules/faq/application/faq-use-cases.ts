import type { CategoryInput, FaqInput, FaqListQuery } from "@faq/contracts";
import { AppError } from "../../../infrastructure/http/errors.js";
import { createCategory as buildCategory } from "../domain/category.js";
import { createFaqEntry, reviseFaqEntry, setFaqAvailability } from "../domain/faq-entry.js";
import type { CategoryRepository, FaqRepository } from "./ports.js";

interface Dependencies {
  categories: CategoryRepository;
  faqs: FaqRepository;
  ids: { create(): string };
  clock: { now(): Date };
}

export function createFaqUseCases(dependencies: Dependencies) {
  const requireFaq = async (id: string) => {
    const faq = await dependencies.faqs.getFaq(id);
    if (!faq) throw new AppError("FAQ_NOT_FOUND", "FAQ not found.", 404);
    return faq;
  };

  return {
    listCategories: () => dependencies.categories.listCategories(),
    createCategory: (input: CategoryInput) =>
      dependencies.categories.createCategory(
        buildCategory(input.name, dependencies.ids.create(), dependencies.clock.now())
      ),
    listFaqs: (query: FaqListQuery) => dependencies.faqs.listFaqs(query),
    getFaq: requireFaq,
    async createFaq(input: FaqInput) {
      const faq = createFaqEntry(input, {
        id: dependencies.ids.create(),
        now: dependencies.clock.now()
      });
      return dependencies.faqs.saveFaq(faq, true);
    },
    async updateFaq(id: string, input: FaqInput) {
      const current = await requireFaq(id);
      const revised = reviseFaqEntry(current, input, dependencies.clock.now());
      return dependencies.faqs.saveFaq(revised, revised !== current);
    },
    async changeStatus(id: string, active: boolean) {
      const current = await requireFaq(id);
      const changed = setFaqAvailability(current, active, dependencies.clock.now());
      if (changed === current) return current;
      const saved = await dependencies.faqs.saveFaq(changed, active);
      if (!active && current.status === "active") {
        await dependencies.faqs.incrementKnowledgeVersion();
      }
      return saved;
    },
    async retryEmbedding(id: string) {
      const current = await requireFaq(id);
      if (current.status !== "embedding_failed") {
        throw new AppError(
          "FAQ_RETRY_NOT_ALLOWED",
          "FAQ is not eligible for embedding retry.",
          409
        );
      }
      const pending = {
        ...current,
        status: "embedding_pending" as const,
        embeddingError: undefined
      };
      return dependencies.faqs.saveFaq(pending, true);
    }
  };
}
