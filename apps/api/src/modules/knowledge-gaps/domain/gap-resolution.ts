export type GapResolutionStatus = "pending" | "completed" | "failed";

export class GapResolutionTransitionError extends Error {
  readonly code = "INVALID_GAP_RESOLUTION_TRANSITION";

  constructor(
    readonly fromStatus: GapResolutionStatus,
    readonly toStatus: GapResolutionStatus
  ) {
    super(`A gap resolution cannot transition from ${fromStatus} to ${toStatus}.`);
  }
}

export function transitionGapResolution(
  fromStatus: GapResolutionStatus,
  toStatus: GapResolutionStatus
): GapResolutionStatus {
  const allowed =
    (fromStatus === "pending" && (toStatus === "completed" || toStatus === "failed")) ||
    (fromStatus === "failed" && toStatus === "pending");
  if (!allowed) throw new GapResolutionTransitionError(fromStatus, toStatus);
  return toStatus;
}
