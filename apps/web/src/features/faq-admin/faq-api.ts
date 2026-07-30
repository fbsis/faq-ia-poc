import {
  categorySchema,
  faqPageSchema,
  faqSchema,
  type Category,
  type CategoryInput,
  type Faq,
  type FaqInput,
  type FaqListQuery
} from "@faq/contracts";
import { z } from "zod";
import { requestJson } from "../../shared/api/http-client.js";

export const listCategories = () =>
  requestJson("/api/v1/categories", { method: "GET", schema: z.array(categorySchema) });

export const createCategory = (input: CategoryInput): Promise<Category> =>
  requestJson("/api/v1/categories", {
    method: "POST",
    body: JSON.stringify(input),
    schema: categorySchema
  });

export const listFaqs = (query: Partial<FaqListQuery> = {}) => {
  const parameters = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20)
  });
  if (query.status) parameters.set("status", query.status);
  if (query.categoryId) parameters.set("categoryId", query.categoryId);
  return requestJson(`/api/v1/faqs?${parameters}`, { method: "GET", schema: faqPageSchema });
};

export const createFaq = (input: FaqInput): Promise<Faq> =>
  requestJson("/api/v1/faqs", {
    method: "POST",
    body: JSON.stringify(input),
    schema: faqSchema
  });

export const updateFaq = (id: string, input: FaqInput): Promise<Faq> =>
  requestJson(`/api/v1/faqs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
    schema: faqSchema
  });

export const changeFaqStatus = (id: string, active: boolean): Promise<Faq> =>
  requestJson(`/api/v1/faqs/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
    schema: faqSchema
  });

export const retryFaqEmbedding = (id: string): Promise<Faq> =>
  requestJson(`/api/v1/faqs/${id}/embedding-retries`, {
    method: "POST",
    schema: faqSchema
  });
