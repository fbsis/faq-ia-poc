import type { KnowledgeGapStatus } from "@faq/contracts";
import { AppError } from "../../../infrastructure/http/errors.js";

export type GapAction = "dismissed" | "reopened";

export function targetStatus(
  action: GapAction,
  currentStatus: KnowledgeGapStatus
): KnowledgeGapStatus {
  if (action === "dismissed" && currentStatus === "open") return "dismissed";
  if (action === "reopened" && (currentStatus === "dismissed" || currentStatus === "resolved")) {
    return "open";
  }
  throw new AppError(
    "KNOWLEDGE_GAP_INVALID_TRANSITION",
    `A ${currentStatus} knowledge gap cannot be ${action}.`,
    409
  );
}
