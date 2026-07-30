import type { AskQuestionRequest, AskQuestionResponse } from "@faq/contracts";
import type { Clock, IdGenerator } from "../../../shared/domain/ports.js";
import { createAnswerCacheKey } from "../domain/answer-cache-key.js";
import type { FaqCandidate } from "../domain/faq-candidate.js";
import type { CacheStatus, Interaction } from "../domain/interaction.js";
import { normalizeQuestion } from "../domain/normalize-question.js";
import { decideRetrieval, type RetrievalDecision } from "../domain/retrieval-policy.js";
import type {
  AnswerCache,
  CachedAnswer,
  EmbeddingProvider,
  FaqSearch,
  InteractionRepository,
  KnowledgeVersion
} from "./ports.js";

interface AskQuestionDependencies {
  search: FaqSearch;
  cache: AnswerCache;
  interactions: InteractionRepository;
  embeddings: EmbeddingProvider;
  knowledgeVersion: KnowledgeVersion;
  clock: Clock;
  ids: IdGenerator;
  acceptanceThreshold?: number;
  ambiguityThreshold?: number;
}

export class AskQuestion {
  constructor(private readonly dependencies: AskQuestionDependencies) {}

  async execute(input: AskQuestionRequest): Promise<AskQuestionResponse> {
    const normalizedQuestion = normalizeQuestion(input.question);
    const categoryId = input.categoryId ?? null;
    const knowledgeVersion = await this.dependencies.knowledgeVersion.current();
    const cacheKey = createAnswerCacheKey({
      normalizedQuestion,
      knowledgeVersion,
      categoryId
    });
    let cacheStatus: CacheStatus = "miss";

    try {
      const cached = await this.dependencies.cache.get(cacheKey);
      if (cached) {
        const interactionId = await this.persist(input.question, normalizedQuestion, cached, "hit");
        return toResponse(interactionId, cached);
      }
    } catch {
      cacheStatus = "bypassed";
    }

    const decision = await this.retrieve(normalizedQuestion, categoryId);
    const cached = toCachedAnswer(decision);
    try {
      await this.dependencies.cache.set(cacheKey, cached);
    } catch {
      cacheStatus = "bypassed";
    }

    const interactionId = await this.persist(
      input.question,
      normalizedQuestion,
      cached,
      cacheStatus
    );
    return toResponse(interactionId, cached);
  }

  private async retrieve(
    normalizedQuestion: string,
    categoryId: string | null
  ): Promise<RetrievalDecision> {
    const exact = await this.dependencies.search.findExact(normalizedQuestion, categoryId);
    if (exact) return decideRetrieval({ candidate: exact, exact: true });

    let candidates: FaqCandidate[] = [];
    try {
      const embedding = await this.dependencies.embeddings.embed(normalizedQuestion);
      candidates = await this.dependencies.search.findSemantic(embedding, categoryId, 5);
    } catch {
      candidates = [];
    }
    if (candidates.length === 0) {
      candidates = await this.dependencies.search.findFullText(normalizedQuestion, categoryId, 5);
    }
    return decideRetrieval({
      candidate: candidates[0] ?? null,
      exact: false,
      acceptanceThreshold: this.dependencies.acceptanceThreshold,
      ambiguityThreshold: this.dependencies.ambiguityThreshold
    });
  }

  private async persist(
    rawQuestion: string,
    normalizedQuestion: string,
    result: CachedAnswer,
    cacheStatus: CacheStatus
  ): Promise<string> {
    const candidate = result.candidate;
    const interaction: Interaction = {
      id: this.dependencies.ids.next(),
      rawQuestion,
      normalizedQuestion,
      outcome: result.status,
      faqId: candidate?.id ?? null,
      categoryId: candidate?.category.id ?? null,
      answerSnapshot: result.status === "answered" ? (candidate?.answer ?? null) : null,
      categorySnapshot: candidate?.category.name ?? null,
      confidence: candidate?.confidence ?? null,
      cacheStatus,
      createdAt: this.dependencies.clock.now()
    };
    await this.dependencies.interactions.save(interaction);
    return interaction.id;
  }
}

function toCachedAnswer(decision: RetrievalDecision): CachedAnswer {
  return {
    status: decision.outcome,
    ...("candidate" in decision && decision.candidate ? { candidate: decision.candidate } : {})
  };
}

function toResponse(interactionId: string, result: CachedAnswer): AskQuestionResponse {
  if (result.status === "answered" && result.candidate) {
    return {
      interactionId,
      status: "answered",
      message: "Encontrei uma resposta aprovada para sua pergunta.",
      answer: result.candidate.answer,
      matchedQuestion: result.candidate.canonicalQuestion,
      category: result.candidate.category
    };
  }
  if (result.status === "ambiguous" && result.candidate) {
    return {
      interactionId,
      status: "ambiguous",
      message: "Encontrei uma pergunta parecida. Confirme se ela representa sua dúvida.",
      suggestions: [result.candidate.canonicalQuestion]
    };
  }
  return {
    interactionId,
    status: "unanswered",
    message: "Ainda não encontrei uma resposta aprovada para essa pergunta."
  };
}
