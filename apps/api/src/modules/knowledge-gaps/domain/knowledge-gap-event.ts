import type { KnowledgeGapStatus } from "./knowledge-gap.js";

export type GapAction = "dismissed" | "reopened";
export type KnowledgeGapEventType =
  "resolution_started" | "resolved" | "resolution_failed" | "dismissed" | "reopened";

export class KnowledgeGapTransitionError extends Error {
  readonly code = "KNOWLEDGE_GAP_INVALID_TRANSITION";

  constructor(
    readonly eventType: KnowledgeGapEventType,
    readonly fromStatus: KnowledgeGapStatus
  ) {
    super(`A ${fromStatus} knowledge gap cannot apply the ${eventType} event.`);
  }
}

export function transitionKnowledgeGap(
  eventType: KnowledgeGapEventType,
  fromStatus: KnowledgeGapStatus
): KnowledgeGapStatus {
  if (eventType === "resolution_started" && fromStatus === "open") return "resolving";
  if (eventType === "resolved" && fromStatus === "resolving") return "resolved";
  if (eventType === "resolution_failed" && fromStatus === "resolving") return "open";
  if (eventType === "dismissed" && fromStatus === "open") return "dismissed";
  if (eventType === "reopened" && (fromStatus === "dismissed" || fromStatus === "resolved")) {
    return "open";
  }
  throw new KnowledgeGapTransitionError(eventType, fromStatus);
}

export function assertKnowledgeGapEvent(event: {
  type: KnowledgeGapEventType;
  fromStatus: KnowledgeGapStatus;
  toStatus: KnowledgeGapStatus;
  reason?: string;
}): void {
  if (transitionKnowledgeGap(event.type, event.fromStatus) !== event.toStatus) {
    throw new KnowledgeGapTransitionError(event.type, event.fromStatus);
  }
  if (event.type === "dismissed" && !event.reason?.trim()) {
    throw new KnowledgeGapTransitionError(event.type, event.fromStatus);
  }
}

export function targetStatus(
  action: GapAction,
  currentStatus: KnowledgeGapStatus
): KnowledgeGapStatus {
  return transitionKnowledgeGap(action, currentStatus);
}
