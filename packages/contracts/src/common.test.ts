import { describe, expect, it } from "vitest";
import { dateRangeSchema, errorEnvelopeSchema, pageRequestSchema } from "./common.js";

describe("common contracts", () => {
  it("accepts the stable error envelope", () => {
    expect(
      errorEnvelopeSchema.parse({
        code: "VALIDATION_ERROR",
        message: "Invalid request.",
        requestId: "req-1",
        details: { field: "question" }
      })
    ).toMatchObject({ code: "VALIDATION_ERROR", requestId: "req-1" });
  });

  it("applies bounded pagination defaults", () => {
    expect(pageRequestSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(() => pageRequestSchema.parse({ pageSize: 101 })).toThrow();
  });

  it("rejects inverted date ranges", () => {
    expect(() => dateRangeSchema.parse({ from: "2026-08-01", to: "2026-07-01" })).toThrow();
  });
});
