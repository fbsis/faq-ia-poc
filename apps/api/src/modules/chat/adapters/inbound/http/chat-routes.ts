import { askQuestionRequestSchema } from "@faq/contracts";
import type { FastifyInstance } from "fastify";
import { AppError } from "../../../../../infrastructure/http/errors.js";
import type { AskQuestion } from "../../../application/ask-question.js";
import { QuestionProcessingUnavailableError } from "../../../application/question-processing-unavailable-error.js";

export function registerChatRoutes(app: FastifyInstance, askQuestion: AskQuestion): void {
  app.post("/api/v1/chat/questions", async (request) => {
    const input = askQuestionRequestSchema.parse(request.body);
    try {
      return await askQuestion.execute(input);
    } catch (error) {
      if (error instanceof QuestionProcessingUnavailableError) {
        throw new AppError(
          "CHAT_UNAVAILABLE",
          "Não foi possível registrar sua pergunta com segurança. Tente novamente.",
          503
        );
      }
      throw error;
    }
  });
}
