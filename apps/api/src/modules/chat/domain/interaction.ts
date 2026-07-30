export type InteractionOutcome = "answered" | "ambiguous" | "unanswered" | "failed";
export type CacheStatus = "hit" | "miss" | "bypassed";

export interface Interaction {
  readonly id: string;
  readonly rawQuestion: string;
  readonly normalizedQuestion: string;
  readonly outcome: InteractionOutcome;
  readonly faqId: string | null;
  readonly categoryId: string | null;
  readonly answerSnapshot: string | null;
  readonly categorySnapshot: string | null;
  readonly confidence: number | null;
  readonly cacheStatus: CacheStatus;
  readonly createdAt: Date;
}
