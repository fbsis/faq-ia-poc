import { describe, expect, it } from "vitest";
import {
  GapResolutionTransitionError,
  transitionGapResolution
} from "../../../src/modules/knowledge-gaps/domain/gap-resolution.js";
import {
  KnowledgeGapTransitionError,
  assertKnowledgeGapEvent,
  transitionKnowledgeGap
} from "../../../src/modules/knowledge-gaps/domain/knowledge-gap-event.js";

describe("knowledge gap domain transitions", () => {
  it("allows the complete resolution lifecycle and rejects invalid transitions", () => {
    expect(transitionGapResolution("pending", "completed")).toBe("completed");
    expect(transitionGapResolution("pending", "failed")).toBe("failed");
    expect(transitionGapResolution("failed", "pending")).toBe("pending");

    expect(() => transitionGapResolution("completed", "failed")).toThrow(
      GapResolutionTransitionError
    );
  });

  it("derives every auditable knowledge-gap transition", () => {
    expect(transitionKnowledgeGap("resolution_started", "open")).toBe("resolving");
    expect(transitionKnowledgeGap("resolved", "resolving")).toBe("resolved");
    expect(transitionKnowledgeGap("resolution_failed", "resolving")).toBe("open");
    expect(transitionKnowledgeGap("dismissed", "open")).toBe("dismissed");
    expect(transitionKnowledgeGap("reopened", "dismissed")).toBe("open");
    expect(transitionKnowledgeGap("reopened", "resolved")).toBe("open");
  });

  it("requires valid statuses and a reason for dismissed audit events", () => {
    expect(() =>
      assertKnowledgeGapEvent({
        type: "dismissed",
        fromStatus: "open",
        toStatus: "dismissed"
      })
    ).toThrow(KnowledgeGapTransitionError);
    expect(() =>
      assertKnowledgeGapEvent({
        type: "resolved",
        fromStatus: "open",
        toStatus: "resolved"
      })
    ).toThrow(KnowledgeGapTransitionError);

    expect(
      assertKnowledgeGapEvent({
        type: "dismissed",
        fromStatus: "open",
        toStatus: "dismissed",
        reason: "Fora do escopo."
      })
    ).toBeUndefined();
  });
});
