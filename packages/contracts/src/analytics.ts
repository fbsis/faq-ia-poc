import { z } from "zod";
import { identifierSchema } from "./common.js";

const DAY_IN_MILLISECONDS = 86_400_000;
const MAX_RANGE_IN_DAYS = 365;

export const analyticsRequestSchema = z
  .object({
    from: z.string().date(),
    to: z.string().date()
  })
  .strict()
  .superRefine((range, context) => {
    const days = (Date.parse(range.to) - Date.parse(range.from)) / DAY_IN_MILLISECONDS;
    if (days < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "The analytics date range is reversed."
      });
    } else if (days > MAX_RANGE_IN_DAYS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "The analytics date range cannot exceed twelve months."
      });
    }
  });

const questionMetricSchema = z.object({
  question: z.string().min(1),
  count: z.number().int().nonnegative()
});

export const analyticsSummarySchema = z.object({
  range: analyticsRequestSchema.innerType().extend({
    timeZone: z.string().min(1),
    granularity: z.enum(["day", "month"])
  }),
  totalQueries: z.number().int().nonnegative(),
  answeredQueries: z.number().int().nonnegative(),
  unansweredQueries: z.number().int().nonnegative(),
  knowledgeGapBacklog: z.object({
    open: z.number().int().nonnegative(),
    resolving: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    dismissed: z.number().int().nonnegative()
  }),
  topQuestions: z.array(questionMetricSchema),
  unansweredQuestions: z.array(
    questionMetricSchema.extend({
      lastOccurredAt: z.string().datetime({ offset: true })
    })
  ),
  categoryDistribution: z.array(
    z.object({
      categoryId: identifierSchema.nullable().optional(),
      categoryName: z.string().min(1),
      count: z.number().int().nonnegative()
    })
  ),
  timeline: z.array(
    z.object({
      date: z.string().date(),
      count: z.number().int().nonnegative()
    })
  )
});

export type AnalyticsRequest = z.infer<typeof analyticsRequestSchema>;
export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;
