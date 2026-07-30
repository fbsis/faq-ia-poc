import type { FaqCandidate } from "./faq-candidate.js";

export type RetrievalDecision =
  | { outcome: "answered"; candidate: FaqCandidate }
  | { outcome: "ambiguous"; candidate: FaqCandidate }
  | { outcome: "unanswered"; candidate?: FaqCandidate };

export interface RetrievalInput {
  candidate: FaqCandidate | null;
  exact: boolean;
  acceptanceThreshold?: number;
  ambiguityThreshold?: number;
}

export function decideRetrieval(input: RetrievalInput): RetrievalDecision {
  if (!input.candidate) return { outcome: "unanswered" };
  if (input.exact) return { outcome: "answered", candidate: input.candidate };

  const acceptance = input.acceptanceThreshold ?? 0.78;
  const ambiguity = input.ambiguityThreshold ?? 0.7;
  if (input.candidate.confidence >= acceptance) {
    return { outcome: "answered", candidate: input.candidate };
  }
  if (input.candidate.confidence >= ambiguity) {
    return { outcome: "ambiguous", candidate: input.candidate };
  }
  return { outcome: "unanswered", candidate: input.candidate };
}
