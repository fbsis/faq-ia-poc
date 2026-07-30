import { z } from "zod";
import { identifierSchema, pageMetadataSchema, pageRequestSchema } from "./common.js";

const trimmed = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);

export const categoryInputSchema = z.object({
  name: trimmed(2, 80)
});

export const categorySummarySchema = z.object({
  id: identifierSchema,
  name: z.string().min(1)
});

export const categorySchema = categorySummarySchema.extend({
  slug: z.string().min(1),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const faqStatusSchema = z.enum([
  "draft",
  "embedding_pending",
  "active",
  "embedding_failed",
  "inactive"
]);

export const faqInputSchema = z
  .object({
    categoryId: identifierSchema,
    question: trimmed(3, 500),
    aliases: z.array(trimmed(3, 500)).max(20).default([]),
    answer: trimmed(1, 10_000)
  })
  .superRefine(({ aliases }, context) => {
    const normalized = aliases.map((alias) => alias.toLocaleLowerCase("pt-BR"));
    if (new Set(normalized).size !== aliases.length) {
      context.addIssue({
        code: "custom",
        path: ["aliases"],
        message: "FAQ aliases must be unique."
      });
    }
  });

export const faqSchema = z.object({
  id: identifierSchema,
  category: categorySummarySchema,
  question: z.string().min(1),
  aliases: z.array(z.string()),
  answer: z.string().min(1),
  status: faqStatusSchema,
  contentVersion: z.number().int().positive(),
  embeddingError: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const faqPageSchema = pageMetadataSchema.extend({
  items: z.array(faqSchema)
});

export const faqListQuerySchema = pageRequestSchema.extend({
  status: faqStatusSchema.optional(),
  categoryId: identifierSchema.optional()
});

export const faqStatusInputSchema = z.object({ active: z.boolean() });
export const faqIdParamsSchema = z.object({ faqId: identifierSchema });

export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type Category = z.infer<typeof categorySchema>;
export type FaqStatus = z.infer<typeof faqStatusSchema>;
export type FaqInput = z.infer<typeof faqInputSchema>;
export type Faq = z.infer<typeof faqSchema>;
export type FaqPage = z.infer<typeof faqPageSchema>;
export type FaqListQuery = z.infer<typeof faqListQuerySchema>;
