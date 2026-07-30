import type { AskQuestionRequest, AskQuestionResponse } from "@faq/contracts";
import type { Clock, IdGenerator } from "../../../shared/domain/ports.js";
import { createAnswerCacheKey } from "../domain/answer-cache-key.js";
import type { FaqCandidate } from "../domain/faq-candidate.js";
import type { CacheStatus, Interaction } from "../domain/interaction.js";
import { normalizeQuestion } from "../domain/normalize-question.js";
import { decideRetrieval, type RetrievalDecision } from "../domain/retrieval-policy.js";
import type { UnansweredInteractionRecorder } from "../../knowledge-gaps/application/ports.js";
import type {
  AnswerCache,
  CachedAnswer,
  ConversationAgent,
  EmbeddingProvider,
  FaqSearch,
  InteractionRepository,
  KnowledgeVersion
} from "./ports.js";
import { QuestionProcessingUnavailableError } from "./question-processing-unavailable-error.js";

interface AskQuestionDependencies {
  search: FaqSearch;
  cache: AnswerCache;
  interactions: InteractionRepository;
  unanswered: UnansweredInteractionRecorder;
  embeddings: EmbeddingProvider;
  conversation: ConversationAgent;
  knowledgeVersion: KnowledgeVersion;
  clock: Clock;
  ids: IdGenerator;
  acceptanceThreshold?: number;
  ambiguityThreshold?: number;
}

const UNKNOWN_ANSWER_PREFIX =
  "Não sei responder essa pergunta com segurança ainda. Talvez eu precise de mais explicações.";
const CLARIFICATION_FALLBACK =
  "Você pode explicar melhor o que está tentando fazer e em qual etapa surgiu a dúvida?";
const HUMAN_HANDOFF_MESSAGE =
  "Não sei responder essa pergunta porque essa informação não está disponível na nossa base de conhecimento. Uma pessoa da nossa equipe entrará em contato para explicar como isso funciona.";
const UNANSWERED_ATTEMPTS_BEFORE_HANDOFF = 2;

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
    const displayedMessage = await this.createDisplayedMessage(rawQuestion, history, result);
    const interactionId = await this.persist(
      rawQuestion,
      normalizedQuestion,
      result,
      cacheStatus,
      displayedAnswer
    );
    return toResponse(interactionId, result, displayedAnswer, displayedMessage);
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

  private async createDisplayedMessage(
    question: string,
    history: NonNullable<AskQuestionRequest["history"]>,
    result: CachedAnswer
  ): Promise<string | null> {
    if (result.status !== "unanswered") return null;
    if (countPreviousUnanswered(history) >= UNANSWERED_ATTEMPTS_BEFORE_HANDOFF) {
      return HUMAN_HANDOFF_MESSAGE;
    }
    try {
      const clarification = await this.dependencies.conversation.createUnansweredResponse({
        question,
        history
      });
      return `${UNKNOWN_ANSWER_PREFIX} ${clarification}`;
    } catch {
      return `${UNKNOWN_ANSWER_PREFIX} ${CLARIFICATION_FALLBACK}`;
    }
  }

  private async retrieve(
    normalizedQuestion: string,
    categoryId: string | null
  ): Promise<RetrievalDecision> {
    const exact = await this.dependencies.search.findExact(normalizedQuestion, categoryId);
    if (exact) return decideRetrieval({ candidates: [exact], exact: true });

    const [semanticCandidates, lexicalCandidates] = await Promise.all([
      this.findSemantic(normalizedQuestion, categoryId),
      this.dependencies.search
        .findFullText(normalizedQuestion, categoryId, 8)
        .catch(() => [] as FaqCandidate[])
    ]);
    const candidates = mergeCandidates(semanticCandidates, lexicalCandidates);
    return decideRetrieval({
      candidates,
      exact: false,
      acceptanceThreshold: this.dependencies.acceptanceThreshold,
      ambiguityThreshold: this.dependencies.ambiguityThreshold
    });
  }

  private async findSemantic(
    normalizedQuestion: string,
    categoryId: string | null
  ): Promise<FaqCandidate[]> {
    try {
      const embedding = await this.dependencies.embeddings.embed(normalizedQuestion);
      return await this.dependencies.search.findSemantic(embedding, categoryId, 8);
    } catch {
      return [];
    }
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
    try {
      if (interaction.outcome === "answered") {
        await this.dependencies.interactions.save(interaction);
      } else {
        await this.dependencies.unanswered.record(interaction);
      }
    } catch (error) {
      throw new QuestionProcessingUnavailableError({ cause: error });
    }
    return interaction.id;
  }
}

function toCachedAnswer(decision: RetrievalDecision): CachedAnswer {
  return {
    status: decision.outcome,
    ...("candidate" in decision && decision.candidate ? { candidate: decision.candidate } : {}),
    ...("suggestions" in decision ? { suggestions: decision.suggestions } : {})
  };
}

function toResponse(
  interactionId: string,
  result: CachedAnswer,
  displayedAnswer: string | null,
  displayedMessage: string | null
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
      suggestions: (result.suggestions ?? [result.candidate])
        .slice(0, 3)
        .map((candidate) => candidate.canonicalQuestion)
    };
  }
  return {
    interactionId,
    status: "unanswered",
    message: displayedMessage ?? `${UNKNOWN_ANSWER_PREFIX} ${CLARIFICATION_FALLBACK}`
  };
}

function countPreviousUnanswered(history: NonNullable<AskQuestionRequest["history"]>): number {
  const outcomes = history
    .filter((message) => message.role === "assistant")
    .map((message) => message.status);
  let consecutiveUnanswered = 0;
  for (const outcome of outcomes.reverse()) {
    if (outcome !== "unanswered") break;
    consecutiveUnanswered += 1;
  }
  return consecutiveUnanswered;
}

function mergeCandidates(...groups: FaqCandidate[][]): FaqCandidate[] {
  const strongestByFaq = new Map<string, FaqCandidate>();
  for (const candidate of groups.flat()) {
    const current = strongestByFaq.get(candidate.id);
    if (!current || candidate.confidence > current.confidence) {
      strongestByFaq.set(candidate.id, candidate);
    }
  }
  return [...strongestByFaq.values()].sort((left, right) => right.confidence - left.confidence);
}
