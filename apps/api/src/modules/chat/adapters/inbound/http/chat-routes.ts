import { askQuestionRequestSchema } from "@faq/contracts";
import type { FastifyInstance } from "fastify";
import type { AskQuestion } from "../../../application/ask-question.js";

export function registerChatRoutes(app: FastifyInstance, askQuestion: AskQuestion): void {
  app.post("/api/v1/chat/questions", async (request) => {
    const input = askQuestionRequestSchema.parse(request.body);
    return askQuestion.execute(input);
  });
}
