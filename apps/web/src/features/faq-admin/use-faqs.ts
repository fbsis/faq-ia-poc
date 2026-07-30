import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Faq, FaqInput, FaqPage } from "@faq/contracts";
import {
  changeFaqStatus,
  createCategory,
  createFaq,
  listCategories,
  listFaqs,
  retryFaqEmbedding,
  updateFaq
} from "./faq-api.js";

const faqKey = ["faqs"] as const;

export function useFaqAdministration() {
  const client = useQueryClient();
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const faqs = useQuery({ queryKey: faqKey, queryFn: () => listFaqs() });
  const storeFaq = (faq: Faq) => {
    client.setQueryData<FaqPage>(faqKey, (current) => {
      if (!current) return { items: [faq], page: 1, pageSize: 20, total: 1 };
      const exists = current.items.some((item) => item.id === faq.id);
      return {
        ...current,
        total: exists ? current.total : current.total + 1,
        items: [faq, ...current.items.filter((item) => item.id !== faq.id)]
      };
    });
  };

  return {
    categories,
    faqs,
    createCategory: useMutation({
      mutationFn: createCategory,
      onSuccess: (category) =>
        client.setQueryData(["categories"], (current: unknown[] = []) => [...current, category])
    }),
    saveFaq: useMutation({
      mutationFn: ({ id, input }: { id?: string; input: FaqInput }) =>
        id ? updateFaq(id, input) : createFaq(input),
      onSuccess: storeFaq
    }),
    changeStatus: useMutation({
      mutationFn: ({ id, active }: { id: string; active: boolean }) => changeFaqStatus(id, active),
      onSuccess: storeFaq
    }),
    retryEmbedding: useMutation({
      mutationFn: retryFaqEmbedding,
      onSuccess: storeFaq
    })
  };
}
