import { describe, expect, it } from "vitest";
import { ANSWER_INSTRUCTIONS } from "../../../src/modules/chat/adapters/outbound/openai-conversation-agent.js";

describe("grounded conversational answer instructions", () => {
  it("allows helpful elaboration without inventing organization-specific facts", () => {
    expect(ANSWER_INSTRUCTIONS).toMatch(/general explanatory context/i);
    expect(ANSWER_INSTRUCTIONS).toMatch(/step-by-step/i);
    expect(ANSWER_INSTRUCTIONS).toMatch(/organization-specific policies/i);
    expect(ANSWER_INSTRUCTIONS).toMatch(/approved FAQ/i);
  });
});
