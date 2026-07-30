import { describe, expect, it } from "vitest";
import {
  createFaqEntry,
  markEmbeddingActive,
  markEmbeddingFailed,
  reviseFaqEntry,
  setFaqAvailability
} from "../../../src/modules/faq/domain/faq-entry.js";

const input = {
  categoryId: "00000000-0000-4000-8000-000000000001",
  question: "Como redefino minha senha?",
  aliases: ["Esqueci minha senha"],
  answer: "Use o link enviado por e-mail."
};

describe("FAQ lifecycle", () => {
  it("creates valid FAQs pending embedding and rejects invalid content", () => {
    const faq = createFaqEntry(input, {
      id: "00000000-0000-4000-8000-000000000002",
      now: new Date("2026-07-30T12:00:00.000Z")
    });

    expect(faq).toMatchObject({ status: "embedding_pending", contentVersion: 1 });
    expect(() => createFaqEntry({ ...input, answer: "" }, { id: faq.id, now: faq.createdAt })).toThrow();
  });

  it("increments content version only when searchable content changes", () => {
    const faq = createFaqEntry(input, {
      id: "00000000-0000-4000-8000-000000000002",
      now: new Date("2026-07-30T12:00:00.000Z")
    });
    const unchanged = reviseFaqEntry(faq, input, new Date("2026-07-30T13:00:00.000Z"));
    const changed = reviseFaqEntry(faq, { ...input, answer: "Nova resposta." }, new Date());

    expect(unchanged.contentVersion).toBe(1);
    expect(changed).toMatchObject({ contentVersion: 2, status: "embedding_pending" });
  });

  it("ignores stale embedding results and records current failures", () => {
    const faq = createFaqEntry(input, {
      id: "00000000-0000-4000-8000-000000000002",
      now: new Date()
    });

    expect(markEmbeddingActive(faq, 0, new Date()).status).toBe("embedding_pending");
    expect(markEmbeddingActive(faq, 1, new Date()).status).toBe("active");
    expect(markEmbeddingFailed(faq, 1, "provider timeout", new Date())).toMatchObject({
      status: "embedding_failed",
      embeddingError: "provider timeout"
    });
  });

  it("soft-deactivates and restores by scheduling a fresh embedding", () => {
    const active = markEmbeddingActive(
      createFaqEntry(input, {
        id: "00000000-0000-4000-8000-000000000002",
        now: new Date()
      }),
      1,
      new Date()
    );
    const inactive = setFaqAvailability(active, false, new Date());
    const restored = setFaqAvailability(inactive, true, new Date());

    expect(inactive.status).toBe("inactive");
    expect(restored).toMatchObject({ status: "embedding_pending", contentVersion: 2 });
  });
});
