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
  ConversationAgent,
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
  conversation: ConversationAgent;
  knowledgeVersion: KnowledgeVersion;
  clock: Clock;
  ids: IdGenerator;
  acceptanceThreshold?: number;
  ambiguityThreshold?: number;
}

export class AskQuestion {
  constructor(private readonly dependencies: AskQuestionDependencies) {}

  async execute(input: AskQuestionRequest): Promise<AskQuestionResponse> {
    const history = input.history ?? [];
    const searchQuestion = await this.rewriteQuestion(input.question, history);
    const normalizedQuestion = normalizeQuestion(searchQuestion);
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
        return this.complete(input.question, history, normalizedQuestion, cached, "hit");
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

    return this.complete(input.question, history, normalizedQuestion, cached, cacheStatus);
  }

  private async rewriteQuestion(
    question: string,
    history: NonNullable<AskQuestionRequest["history"]>
  ): Promise<string> {
    if (history.length === 0) return question;
    try {
      return await this.dependencies.conversation.rewriteQuestion(question, history);
    } catch {
      return question;
    }
  }

  private async complete(
    rawQuestion: string,
    history: NonNullable<AskQuestionRequest["history"]>,
    normalizedQuestion: string,
    result: CachedAnswer,
    cacheStatus: CacheStatus
  ): Promise<AskQuestionResponse> {
    const displayedAnswer = await this.createDisplayedAnswer(rawQuestion, history, result);
    const interactionId = await this.persist(
      rawQuestion,
      normalizedQuestion,
      result,
      cacheStatus,
      displayedAnswer
    );
    return toResponse(interactionId, result, displayedAnswer);
  }

  private async createDisplayedAnswer(
    question: string,
    history: NonNullable<AskQuestionRequest["history"]>,
    result: CachedAnswer
  ): Promise<string | null> {
    if (result.status !== "answered" || !result.candidate) return null;
    try {
      return await this.dependencies.conversation.createGroundedResponse({
        question,
        history,
        matchedQuestion: result.candidate.canonicalQuestion,
        approvedAnswer: result.candidate.answer
      });
    } catch {
      return result.candidate.answer;
    }
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
    cacheStatus: CacheStatus,
    displayedAnswer: string | null
  ): Promise<string> {
    const candidate = result.candidate;
    const interaction: Interaction = {
      id: this.dependencies.ids.next(),
      rawQuestion,
      normalizedQuestion,
      outcome: result.status,
      faqId: candidate?.id ?? null,
      categoryId: candidate?.category.id ?? null,
      answerSnapshot: displayedAnswer,
      sourceAnswerSnapshot: result.status === "answered" ? (candidate?.answer ?? null) : null,
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

function toResponse(
  interactionId: string,
  result: CachedAnswer,
  displayedAnswer: string | null
): AskQuestionResponse {
  if (result.status === "answered" && result.candidate) {
    return {
      interactionId,
      status: "answered",
      message: "Encontrei uma resposta aprovada para sua pergunta.",
      answer: displayedAnswer ?? result.candidate.answer,
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
