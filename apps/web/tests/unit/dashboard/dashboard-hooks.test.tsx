import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import {
  toTimelineChartData,
  useAnalyticsFilters
} from "../../../src/features/dashboard/use-analytics-filters.js";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/admin?from=2026-07-01&to=2026-07-31"]}>
      {children}
    </MemoryRouter>
  );
}

describe("dashboard hooks", () => {
  it("reads the selected period from the URL and writes updates back to it", () => {
    const { result } = renderHook(() => useAnalyticsFilters(), { wrapper });

    expect(result.current.range).toEqual({ from: "2026-07-01", to: "2026-07-31" });

    act(() => result.current.setRange({ from: "2026-06-01", to: "2026-06-30" }));

    expect(result.current.range).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });

  it("converts timeline points into localized chart labels without changing counts", () => {
    expect(
      toTimelineChartData(
        [
          { date: "2026-07-01", count: 2 },
          { date: "2026-07-02", count: 5 }
        ],
        "day"
      )
    ).toEqual([
      { date: "2026-07-01", label: "01/07", count: 2 },
      { date: "2026-07-02", label: "02/07", count: 5 }
    ]);
  });
});
