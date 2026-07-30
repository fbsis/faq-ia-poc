import { z } from "zod";
import { identifierSchema, pageMetadataSchema, pageRequestSchema } from "./common.js";
import { categorySummarySchema, faqInputObjectSchema, faqStatusSchema } from "./faqs.js";

export const knowledgeGapStatusSchema = z.enum(["open", "resolving", "resolved", "dismissed"]);
export const knowledgeGapSortSchema = z.enum(["occurrences_desc", "latest_desc", "oldest_asc"]);

export const knowledgeGapListQuerySchema = pageRequestSchema
  .extend({
    status: knowledgeGapStatusSchema.optional(),
    from: z.string().date().optional(),
    to: z.string().date().optional(),
    categoryId: identifierSchema.optional(),
    minFrequency: z.coerce.number().int().positive().max(1_000_000).optional(),
    sort: knowledgeGapSortSchema.default("occurrences_desc")
  })
  .superRefine(({ from, to }, context) => {
    if (Boolean(from) !== Boolean(to)) {
      context.addIssue({
        code: "custom",
        path: [from ? "to" : "from"],
        message: "Both knowledge-gap date boundaries are required."
      });
    } else if (from && to && from > to) {
      context.addIssue({
        code: "custom",
        path: ["from"],
        message: "The knowledge-gap date range is reversed."
      });
    }
  });

export const knowledgeGapSchema = z.object({
  id: identifierSchema,
  representativeQuestion: z.string().min(1),
  status: knowledgeGapStatusSchema,
  occurrenceCount: z.number().int().positive(),
  firstOccurredAt: z.string().datetime({ offset: true }),
  lastOccurredAt: z.string().datetime({ offset: true }),
  suggestedCategory: categorySummarySchema.optional(),
  resolvedFaqId: identifierSchema.optional(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true })
});

export const knowledgeGapPageSchema = pageMetadataSchema.extend({
  items: z.array(knowledgeGapSchema)
});

export const gapResolutionSchema = z.object({
  id: identifierSchema,
  knowledgeGapId: identifierSchema,
  mode: z.enum(["create", "update"]),
  faqId: identifierSchema,
  faqStatus: faqStatusSchema,
  status: z.enum(["pending", "completed", "failed"]),
  errorCode: z.string().optional(),
  createdAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).optional()
});

export const knowledgeGapEventSchema = z.object({
  id: identifierSchema,
  type: z.enum(["resolution_started", "resolved", "resolution_failed", "dismissed", "reopened"]),
  fromStatus: knowledgeGapStatusSchema,
  toStatus: knowledgeGapStatusSchema,
  adminId: identifierSchema.nullable(),
  reason: z.string().optional(),
  faqId: identifierSchema.optional(),
  resolutionId: identifierSchema.optional(),
  createdAt: z.string().datetime({ offset: true })
});

export const knowledgeGapDetailsSchema = knowledgeGapSchema.extend({
  occurrences: z.array(
    z.object({
      interactionId: identifierSchema,
      question: z.string().min(1),
      occurredAt: z.string().datetime({ offset: true })
    })
  ),
  currentResolution: gapResolutionSchema.optional(),
  events: z.array(knowledgeGapEventSchema)
});

export const resolveKnowledgeGapInputSchema = faqInputObjectSchema
  .extend({
    mode: z.enum(["create", "update"]),
    faqId: identifierSchema.optional(),
    expectedVersion: z.number().int().positive()
  })
  .superRefine(({ mode, faqId }, context) => {
    if (mode === "update" && !faqId) {
      context.addIssue({
        code: "custom",
        path: ["faqId"],
        message: "An existing FAQ is required in update mode."
      });
    }
  });

export const dismissKnowledgeGapInputSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
    expectedVersion: z.number().int().positive()
  })
  .strict();

export const reopenKnowledgeGapInputSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
    expectedVersion: z.number().int().positive()
  })
  .strict();

export const retryGapResolutionInputSchema = z
  .object({
    expectedVersion: z.number().int().positive()
  })
  .strict();

export const knowledgeGapIdParamsSchema = z.object({
  knowledgeGapId: identifierSchema
});

export const idempotencyKeySchema = z.string().trim().min(8).max(100);

export type KnowledgeGapStatus = z.infer<typeof knowledgeGapStatusSchema>;
export type KnowledgeGapSort = z.infer<typeof knowledgeGapSortSchema>;
export type KnowledgeGapListQuery = z.infer<typeof knowledgeGapListQuerySchema>;
export type KnowledgeGap = z.infer<typeof knowledgeGapSchema>;
export type KnowledgeGapPage = z.infer<typeof knowledgeGapPageSchema>;
export type KnowledgeGapDetails = z.infer<typeof knowledgeGapDetailsSchema>;
export type GapResolution = z.infer<typeof gapResolutionSchema>;
export type KnowledgeGapEvent = z.infer<typeof knowledgeGapEventSchema>;
export type ResolveKnowledgeGapInput = z.infer<typeof resolveKnowledgeGapInputSchema>;
export type DismissKnowledgeGapInput = z.infer<typeof dismissKnowledgeGapInputSchema>;
export type ReopenKnowledgeGapInput = z.infer<typeof reopenKnowledgeGapInputSchema>;
export type RetryGapResolutionInput = z.infer<typeof retryGapResolutionInputSchema>;
