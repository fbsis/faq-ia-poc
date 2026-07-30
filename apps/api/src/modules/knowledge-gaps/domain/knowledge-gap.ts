export type KnowledgeGapStatus = "open" | "resolving" | "resolved" | "dismissed";

export interface KnowledgeGap {
  readonly id: string;
  readonly normalizedQuestion: string;
  readonly representativeQuestion: string;
  readonly status: KnowledgeGapStatus;
  readonly occurrenceCount: number;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly version: number;
  readonly resolvedFaqId: string | null;
}

export function createKnowledgeGap(input: {
  id: string;
  normalizedQuestion: string;
  representativeQuestion: string;
  occurredAt: Date;
}): KnowledgeGap {
  return {
    id: input.id,
    normalizedQuestion: input.normalizedQuestion,
    representativeQuestion: input.representativeQuestion,
    status: "open",
    occurrenceCount: 1,
    firstSeenAt: input.occurredAt,
    lastSeenAt: input.occurredAt,
    version: 1,
    resolvedFaqId: null
  };
}

export function recordKnowledgeGapOccurrence(gap: KnowledgeGap, occurredAt: Date): KnowledgeGap {
  return {
    ...gap,
    status: gap.status === "resolved" || gap.status === "dismissed" ? "open" : gap.status,
    occurrenceCount: gap.occurrenceCount + 1,
    lastSeenAt: occurredAt,
    version: gap.version + 1
  };
}
