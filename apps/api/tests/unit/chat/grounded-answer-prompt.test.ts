import { describe, expect, it } from "vitest";
import {
  ANSWER_INSTRUCTIONS,
  ROUTING_INSTRUCTIONS
} from "../../../src/modules/chat/adapters/outbound/openai-conversation-agent.js";

describe("grounded conversational answer instructions", () => {
  it("allows helpful elaboration without inventing organization-specific facts", () => {
    expect(ANSWER_INSTRUCTIONS).toMatch(/general explanatory context/i);
    expect(ANSWER_INSTRUCTIONS).toMatch(/step-by-step/i);
    expect(ANSWER_INSTRUCTIONS).toMatch(/organization-specific policies/i);
    expect(ANSWER_INSTRUCTIONS).toMatch(/approved FAQ/i);
  });
});

describe("conversation routing instructions", () => {
  it("distinguishes FAQ queries from social messages without turning acknowledgements into questions", () => {
    expect(ROUTING_INSTRUCTIONS).toMatch(/social/i);
    expect(ROUTING_INSTRUCTIONS).toMatch(/FAQ/i);
    expect(ROUTING_INSTRUCTIONS).toMatch(/do not turn/i);
    expect(ROUTING_INSTRUCTIONS).toMatch(/recent messages/i);
  });
});
