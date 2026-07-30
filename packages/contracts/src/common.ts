import { z } from "zod";

export const identifierSchema = z.string().uuid();

export const errorEnvelopeSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional(),
  requestId: z.string().min(1)
});

export const pageRequestSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const pageMetadataSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative()
});

export const dateRangeSchema = z
  .object({
    from: z.string().date(),
    to: z.string().date()
  })
  .refine(({ from, to }) => from <= to, {
    message: "The start date must not be after the end date.",
    path: ["from"]
  });

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
export type PageRequest = z.infer<typeof pageRequestSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
