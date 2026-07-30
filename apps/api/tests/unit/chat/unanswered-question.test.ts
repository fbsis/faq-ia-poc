import { describe, expect, it } from "vitest";
import { AskQuestion } from "../../../src/modules/chat/application/ask-question.js";
import { QuestionProcessingUnavailableError } from "../../../src/modules/chat/application/question-processing-unavailable-error.js";
import type {
  AnswerCache,
  ConversationAgent,
  EmbeddingProvider,
  FaqSearch,
  InteractionRepository,
  KnowledgeVersion
} from "../../../src/modules/chat/application/ports.js";
import type { Interaction } from "../../../src/modules/chat/domain/interaction.js";
import type { UnansweredInteractionRecorder } from "../../../src/modules/knowledge-gaps/application/ports.js";
import { FixedClock, SequentialIds } from "../../helpers/fakes.js";

function createUseCase(options?: {
  failCache?: boolean;
  failEmbedding?: boolean;
  failClarification?: boolean;
  failRecording?: boolean;
  semanticConfidence?: number;
}) {
  const recorded: Interaction[] = [];
  const search: FaqSearch = {
    findExact: () => Promise.resolve(null),
    findSemantic: () =>
      Promise.resolve(
        options?.semanticConfidence === undefined
          ? []
          : [
              {
                id: "faq-1",
                canonicalQuestion: "Pergunta apenas parecida",
                answer: "Resposta que não deve ser afirmada.",
                category: { id: "category-1", name: "Conta" },
                confidence: options.semanticConfidence
              }
            ]
      ),
    findFullText: () => Promise.resolve([])
  };
  const cache: AnswerCache = {
    get: () =>
      options?.failCache ? Promise.reject(new Error("cache unavailable")) : Promise.resolve(null),
    set: () =>
      options?.failCache ? Promise.reject(new Error("cache unavailable")) : Promise.resolve()
  };
  const embeddings: EmbeddingProvider = {
    embed: () =>
      options?.failEmbedding
        ? Promise.reject(new Error("provider unavailable"))
        : Promise.resolve([0.1])
  };
  const conversation: ConversationAgent = {
    rewriteQuestion: (question) => Promise.resolve(question),
    createGroundedResponse: ({ approvedAnswer }) => Promise.resolve(approvedAnswer),
    createUnansweredResponse: () =>
      options?.failClarification
        ? Promise.reject(new Error("provider unavailable"))
        : Promise.resolve(
            "Não encontrei uma resposta segura. Em qual etapa do cadastro surgiu essa dúvida?"
          )
  };
  const interactions: InteractionRepository = {
    save: () => Promise.reject(new Error("unanswered must use the atomic recorder"))
  };
  const unanswered: UnansweredInteractionRecorder = {
    record: (interaction) => {
      if (options?.failRecording) return Promise.reject(new Error("database unavailable"));
      recorded.push(interaction);
      return Promise.resolve();
    }
  };
  const knowledgeVersion: KnowledgeVersion = { current: () => Promise.resolve(1) };

  return {
    useCase: new AskQuestion({
      search,
      cache,
      interactions,
      unanswered,
      embeddings,
      conversation,
      knowledgeVersion,
      clock: new FixedClock(),
      ids: new SequentialIds()
    }),
    recorded
  };
}

describe("unanswered question handling", () => {
  it("records a low-confidence question through the atomic knowledge-gap recorder", async () => {
    const { useCase, recorded } = createUseCase({ semanticConfidence: 0.2 });

    await expect(
      useCase.execute({ question: "Como concluo meu cadastro?" })
    ).resolves.toMatchObject({
      status: "unanswered",
      message: "Não encontrei uma resposta segura. Em qual etapa do cadastro surgiu essa dúvida?"
    });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      rawQuestion: "Como concluo meu cadastro?",
      normalizedQuestion: "como concluo meu cadastro",
      outcome: "unanswered",
      answerSnapshot: null
    });
  });

  it("records an ambiguous suggestion as a knowledge gap without asserting its answer", async () => {
    const { useCase, recorded } = createUseCase({ semanticConfidence: 0.74 });

    await expect(useCase.execute({ question: "Não consigo entrar" })).resolves.toMatchObject({
      status: "ambiguous",
      suggestions: ["Pergunta apenas parecida"]
    });
    expect(recorded[0]).toMatchObject({ outcome: "ambiguous", answerSnapshot: null });
  });

  it("returns deterministic guidance when OpenAI and Redis are unavailable", async () => {
    const { useCase, recorded } = createUseCase({
      failCache: true,
      failEmbedding: true,
      failClarification: true
    });

    await expect(useCase.execute({ question: "Minha solicitação parou" })).resolves.toMatchObject({
      status: "unanswered",
      message:
        "Não encontrei uma resposta confiável ainda. Conte qual resultado você esperava e em qual etapa surgiu a dúvida para eu tentar uma busca mais precisa."
    });
    expect(recorded[0]?.cacheStatus).toBe("bypassed");
  });

  it("does not claim success when atomic recording fails", async () => {
    const { useCase } = createUseCase({ failRecording: true });

    await expect(useCase.execute({ question: "Pergunta desconhecida" })).rejects.toBeInstanceOf(
      QuestionProcessingUnavailableError
    );
  });
});
