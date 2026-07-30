import type { ConversationAgent } from "../../application/ports.js";

export const deterministicConversationAgent: ConversationAgent = {
  routeMessage: (question) => Promise.resolve({ intent: "faq", searchQuestion: question }),
  createGroundedResponse: ({ approvedAnswer }) => Promise.resolve(approvedAnswer),
  createUnansweredResponse: () =>
    Promise.resolve(
      "Você pode explicar melhor o que está tentando fazer e em qual etapa surgiu a dúvida?"
    )
};
