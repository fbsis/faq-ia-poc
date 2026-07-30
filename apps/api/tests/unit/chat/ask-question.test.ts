import { describe, expect, it } from "vitest";
import { AskQuestion } from "../../../src/modules/chat/application/ask-question.js";
import type {
  AnswerCache,
  CachedAnswer,
  ConversationAgent,
  EmbeddingProvider,
  FaqSearch,
  InteractionRepository,
  KnowledgeVersion
} from "../../../src/modules/chat/application/ports.js";
import type { Interaction } from "../../../src/modules/chat/domain/interaction.js";
import type { FaqCandidate } from "../../../src/modules/chat/domain/faq-candidate.js";
import { FixedClock, SequentialIds } from "../../helpers/fakes.js";

const answer: FaqCandidate = {
  id: "faq-1",
  canonicalQuestion: "Como redefino minha senha?",
  answer: "Na tela de login, selecione “Esqueci minha senha”.",
  category: { id: "category-1", name: "Conta" },
  confidence: 1
};

class SearchFake implements FaqSearch {
  exact: FaqCandidate | null = answer;
  semantic: FaqCandidate[] = [];
  fullText: FaqCandidate[] = [];
  exactQuery: string | null = null;
  semanticCalls = 0;
  fullTextCalls = 0;

  findExact(normalizedQuestion: string): Promise<FaqCandidate | null> {
    this.exactQuery = normalizedQuestion;
    return Promise.resolve(this.exact);
  }
  findSemantic(): Promise<FaqCandidate[]> {
    this.semanticCalls += 1;
    return Promise.resolve(this.semantic);
  }
  findFullText(): Promise<FaqCandidate[]> {
    this.fullTextCalls += 1;
    return Promise.resolve(this.fullText);
  }
}

class ConversationAgentFake implements ConversationAgent {
  rewrittenQuestion = "Como redefino minha senha?";
  response = "Claro! Na tela de login, clique em “Esqueci minha senha”.";
  failResponse = false;
  unansweredResponse =
    "Para eu procurar melhor, você pode explicar qual etapa está tentando concluir?";
  failUnansweredResponse = false;

  rewriteQuestion(): Promise<string> {
    return Promise.resolve(this.rewrittenQuestion);
  }

  createGroundedResponse(): Promise<string> {
    return this.failResponse
      ? Promise.reject(new Error("provider unavailable"))
      : Promise.resolve(this.response);
  }

  createUnansweredResponse(): Promise<string> {
    return this.failUnansweredResponse
      ? Promise.reject(new Error("provider unavailable"))
      : Promise.resolve(this.unansweredResponse);
  }
}

class CacheFake implements AnswerCache {
  value: CachedAnswer | null = null;
  fail = false;

  get(): Promise<CachedAnswer | null> {
    if (this.fail) return Promise.reject(new Error("redis unavailable"));
    return Promise.resolve(this.value);
  }
  set(): Promise<void> {
    return this.fail ? Promise.reject(new Error("redis unavailable")) : Promise.resolve();
  }
}

class InteractionFake implements InteractionRepository {
  records: Interaction[] = [];
  save(interaction: Interaction): Promise<void> {
    this.records.push(interaction);
    return Promise.resolve();
  }
}

function createUseCase(overrides?: {
  search?: SearchFake;
  cache?: CacheFake;
  conversation?: ConversationAgentFake;
}) {
  const search = overrides?.search ?? new SearchFake();
  const cache = overrides?.cache ?? new CacheFake();
  const interactions = new InteractionFake();
  const conversation = overrides?.conversation ?? new ConversationAgentFake();
  const embeddings: EmbeddingProvider = {
    embed: () => Promise.resolve([0.1, 0.2])
  };
  const version: KnowledgeVersion = { current: () => Promise.resolve(3) };
  return {
    useCase: new AskQuestion({
      search,
      cache,
      interactions,
      embeddings,
      conversation,
      knowledgeVersion: version,
      clock: new FixedClock(),
      ids: new SequentialIds()
    }),
    search,
    cache,
    interactions,
    conversation
  };
}

describe("AskQuestion", () => {
  it("returns an approved exact answer and persists its immutable snapshot", async () => {
    const { useCase, interactions, conversation } = createUseCase();
    const response = await useCase.execute({ question: "Como redefino minha senha?" });

    expect(response).toMatchObject({
      status: "answered",
      answer: conversation.response,
      matchedQuestion: answer.canonicalQuestion
    });
    expect(interactions.records[0]).toMatchObject({
      outcome: "answered",
      answerSnapshot: conversation.response,
      sourceAnswerSnapshot: answer.answer,
      cacheStatus: "miss"
    });
  });

  it("returns an ambiguous result without presenting an answer", async () => {
    const search = new SearchFake();
    search.exact = null;
    search.semantic = [{ ...answer, confidence: 0.74 }];
    const { useCase } = createUseCase({ search });

    await expect(useCase.execute({ question: "Não consigo acessar" })).resolves.toMatchObject({
      status: "ambiguous",
      suggestions: [answer.canonicalQuestion]
    });
  });

  it("records every cache hit as a new interaction", async () => {
    const cache = new CacheFake();
    cache.value = { status: "answered", candidate: answer };
    const { useCase, interactions } = createUseCase({ cache });

    await useCase.execute({ question: "Como redefino minha senha?" });
    await useCase.execute({ question: "Como redefino minha senha?" });

    expect(interactions.records).toHaveLength(2);
    expect(interactions.records.every((record) => record.cacheStatus === "hit")).toBe(true);
  });

  it("fails open when Redis is unavailable", async () => {
    const cache = new CacheFake();
    cache.fail = true;
    const { useCase, interactions } = createUseCase({ cache });

    await expect(
      useCase.execute({ question: "Como redefino minha senha?" })
    ).resolves.toMatchObject({ status: "answered" });
    expect(interactions.records[0]?.cacheStatus).toBe("bypassed");
  });

  it("uses recent context to retrieve a FAQ and returns a grounded natural response", async () => {
    const { useCase, search, interactions, conversation } = createUseCase();

    const response = await useCase.execute({
      question: "E se eu não lembrar?",
      history: [
        { role: "user", content: "Preciso entrar na minha conta." },
        { role: "assistant", content: "Você quer redefinir sua senha?" }
      ]
    });

    expect(search.exactQuery).toBe("como redefino minha senha");
    expect(response).toMatchObject({
      status: "answered",
      answer: conversation.response,
      matchedQuestion: answer.canonicalQuestion
    });
    expect(interactions.records[0]).toMatchObject({
      answerSnapshot: conversation.response,
      sourceAnswerSnapshot: answer.answer
    });
  });

  it("returns the approved answer verbatim when conversational generation fails", async () => {
    const conversation = new ConversationAgentFake();
    conversation.failResponse = true;
    const { useCase, interactions } = createUseCase({ conversation });

    const response = await useCase.execute({ question: "Como redefino minha senha?" });

    expect(response).toMatchObject({ status: "answered", answer: answer.answer });
    expect(interactions.records[0]).toMatchObject({
      answerSnapshot: answer.answer,
      sourceAnswerSnapshot: answer.answer
    });
  });

  it("uses semantic and lexical retrieval together and keeps the strongest candidate", async () => {
    const search = new SearchFake();
    search.exact = null;
    search.semantic = [{ ...answer, id: "semantic-faq", confidence: 0.72 }];
    search.fullText = [{ ...answer, id: "lexical-faq", confidence: 0.81 }];
    const { useCase } = createUseCase({ search });

    const response = await useCase.execute({ question: "recuperar acesso com senha parecida" });

    expect(search.semanticCalls).toBe(1);
    expect(search.fullTextCalls).toBe(1);
    expect(response).toMatchObject({
      status: "answered",
      matchedQuestion: answer.canonicalQuestion
    });
  });

  it("asks a contextual clarification when no approved answer is reliable", async () => {
    const search = new SearchFake();
    search.exact = null;
    const { useCase, conversation } = createUseCase({ search });

    const response = await useCase.execute({ question: "Não está funcionando" });

    expect(response).toMatchObject({
      status: "unanswered",
      message: conversation.unansweredResponse
    });
  });

  it("uses actionable deterministic guidance when unanswered generation fails", async () => {
    const search = new SearchFake();
    search.exact = null;
    const conversation = new ConversationAgentFake();
    conversation.failUnansweredResponse = true;
    const { useCase } = createUseCase({ search, conversation });

    const response = await useCase.execute({ question: "Não está funcionando" });

    expect(response).toMatchObject({
      status: "unanswered",
      message:
        "Não encontrei uma resposta confiável ainda. Conte qual resultado você esperava e em qual etapa surgiu a dúvida para eu tentar uma busca mais precisa."
    });
  });
});
