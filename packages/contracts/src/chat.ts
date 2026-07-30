import { z } from "zod";
import { identifierSchema } from "./common.js";

export const conversationMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(1000)
  })
  .strict();

export const askQuestionRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(500),
    categoryId: identifierSchema.optional(),
    history: z.array(conversationMessageSchema).max(6).optional()
  })
  .strict();

const categorySummarySchema = z.object({
  id: identifierSchema,
  name: z.string().min(1)
});

export const askQuestionResponseSchema = z.object({
  interactionId: identifierSchema,
  status: z.enum(["answered", "ambiguous", "unanswered"]),
  message: z.string().min(1),
  answer: z.string().min(1).optional(),
  matchedQuestion: z.string().min(1).optional(),
  category: categorySummarySchema.optional(),
  suggestions: z.array(z.string().min(1)).max(3).optional()
});

export type AskQuestionRequest = z.infer<typeof askQuestionRequestSchema>;
export type AskQuestionResponse = z.infer<typeof askQuestionResponseSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
