import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DashboardPage } from "../../../src/features/dashboard/dashboard-page.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/admin?from=2026-07-01&to=2026-07-31"]}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("analytics dashboard", () => {
  it("announces loading before rendering data", async () => {
    server.use(
      http.get("/api/v1/analytics/summary", async () => {
        await delay(100);
        return HttpResponse.json(summary);
      })
    );
    renderPage();

    expect(screen.getByText(/carregando indicadores/i)).toBeVisible();
    expect(await screen.findByText("12")).toBeVisible();
  });

  it("renders KPIs, backlog, charts, and accessible source tables", async () => {
    server.use(http.get("/api/v1/analytics/summary", () => HttpResponse.json(summary)));
    renderPage();

    expect(await screen.findByRole("heading", { name: /visão geral/i })).toBeVisible();
    expect(screen.getByText("12")).toBeVisible();
    expect(screen.getByText("8")).toBeVisible();
    expect(screen.getByText("4")).toBeVisible();
    expect(screen.getByText(/2 pendências abertas/i)).toBeVisible();
    expect(screen.getByRole("table", { name: /consultas ao longo do tempo/i })).toBeVisible();
    expect(screen.getByRole("table", { name: /distribuição por categoria/i })).toBeVisible();
    expect(screen.getByRole("table", { name: /perguntas mais frequentes/i })).toBeVisible();
  });

  it("shows a clear empty state", async () => {
    server.use(
      http.get("/api/v1/analytics/summary", () =>
        HttpResponse.json({
          ...summary,
          totalQueries: 0,
          answeredQueries: 0,
          unansweredQueries: 0,
          topQuestions: [],
          unansweredQuestions: [],
          categoryDistribution: [],
          timeline: []
        })
      )
    );
    renderPage();

    expect(await screen.findByText(/nenhuma consulta neste período/i)).toBeVisible();
  });

  it("shows an actionable error and retries the same period", async () => {
    let attempts = 0;
    server.use(
      http.get("/api/v1/analytics/summary", () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json(
              { code: "INTERNAL_ERROR", message: "Falha", requestId: "request-1" },
              { status: 500 }
            )
          : HttpResponse.json(summary);
      })
    );
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível carregar/i);
    await userEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));

    expect(await screen.findByText("12")).toBeVisible();
    expect(attempts).toBe(2);
  });
});

const summary = {
  range: {
    from: "2026-07-01",
    to: "2026-07-31",
    timeZone: "America/Sao_Paulo",
    granularity: "day"
  },
  totalQueries: 12,
  answeredQueries: 8,
  unansweredQueries: 4,
  knowledgeGapBacklog: { open: 2, resolving: 1, resolved: 3, dismissed: 1 },
  topQuestions: [{ question: "Como redefino minha senha?", count: 5 }],
  unansweredQuestions: [
    {
      question: "Como altero meu cadastro?",
      count: 3,
      lastOccurredAt: "2026-07-30T12:00:00.000Z"
    }
  ],
  categoryDistribution: [
    {
      categoryId: "00000000-0000-4000-8000-000000000001",
      categoryName: "Conta",
      count: 8
    },
    { categoryId: null, categoryName: "Sem categoria", count: 4 }
  ],
  timeline: [
    { date: "2026-07-01", count: 4 },
    { date: "2026-07-02", count: 8 }
  ]
};
