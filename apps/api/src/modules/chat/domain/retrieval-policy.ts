import type { FaqCandidate } from "./faq-candidate.js";

export type RetrievalDecision =
  | { outcome: "answered"; candidate: FaqCandidate }
  | {
      outcome: "ambiguous";
      candidate: FaqCandidate;
      suggestions: FaqCandidate[];
    }
  | { outcome: "unanswered"; candidate?: FaqCandidate };

export interface RetrievalInput {
  candidates: FaqCandidate[];
  exact: boolean;
  acceptanceThreshold?: number;
  ambiguityThreshold?: number;
}

export function decideRetrieval(input: RetrievalInput): RetrievalDecision {
  const candidate = input.candidates[0];
  if (!candidate) return { outcome: "unanswered" };
  if (input.exact) return { outcome: "answered", candidate };

  const acceptance = input.acceptanceThreshold ?? 0.78;
  const ambiguity = input.ambiguityThreshold ?? 0.7;
  if (candidate.confidence >= acceptance) {
    return { outcome: "answered", candidate };
  }
  const plausible = input.candidates.filter((item) => item.confidence >= ambiguity);
  if (plausible.length === 1) {
    return { outcome: "answered", candidate };
  }
  if (plausible.length > 1) {
    return {
      outcome: "ambiguous",
      candidate,
      suggestions: plausible.slice(0, 3)
    };
  }
  return { outcome: "unanswered", candidate };
}
