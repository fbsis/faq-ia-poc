import { describe, expect, it } from "vitest";
import { AskQuestion } from "../../../src/modules/chat/application/ask-question.js";
import type {
  AnswerCache,
  CachedAnswer,
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

  findExact(): Promise<FaqCandidate | null> {
    return Promise.resolve(this.exact);
  }
  findSemantic(): Promise<FaqCandidate[]> {
    return Promise.resolve(this.semantic);
  }
  findFullText(): Promise<FaqCandidate[]> {
    return Promise.resolve([]);
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

function createUseCase(overrides?: { search?: SearchFake; cache?: CacheFake }) {
  const search = overrides?.search ?? new SearchFake();
  const cache = overrides?.cache ?? new CacheFake();
  const interactions = new InteractionFake();
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
      knowledgeVersion: version,
      clock: new FixedClock(),
      ids: new SequentialIds()
    }),
    search,
    cache,
    interactions
  };
}

describe("AskQuestion", () => {
  it("returns an approved exact answer and persists its immutable snapshot", async () => {
    const { useCase, interactions } = createUseCase();
    const response = await useCase.execute({ question: "Como redefino minha senha?" });

    expect(response).toMatchObject({
      status: "answered",
      answer: answer.answer,
      matchedQuestion: answer.canonicalQuestion
    });
    expect(interactions.records[0]).toMatchObject({
      outcome: "answered",
      answerSnapshot: answer.answer,
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
});
