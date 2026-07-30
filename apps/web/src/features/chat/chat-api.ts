import {
  askQuestionResponseSchema,
  type AskQuestionRequest,
  type AskQuestionResponse
} from "@faq/contracts";
import { requestJson } from "../../shared/api/http-client.js";

export function askQuestion(input: AskQuestionRequest): Promise<AskQuestionResponse> {
  return requestJson("/api/v1/chat/questions", {
    method: "POST",
    body: JSON.stringify(input),
    schema: askQuestionResponseSchema
  });
}
