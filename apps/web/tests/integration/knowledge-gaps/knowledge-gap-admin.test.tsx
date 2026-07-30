import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { KnowledgeGapAdminPage } from "../../../src/features/knowledge-gap-admin/knowledge-gap-admin-page.js";

const gap = {
  id: "00000000-0000-4000-8000-000000000101",
  representativeQuestion: "Como emitir a segunda via?",
  status: "open",
  occurrenceCount: 2,
  firstOccurredAt: "2026-07-29T12:00:00.000Z",
  lastOccurredAt: "2026-07-30T12:00:00.000Z",
  version: 2,
  createdAt: "2026-07-29T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z"
};
const server = setupServer(
  http.get("/api/v1/categories", () => HttpResponse.json([]))
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <KnowledgeGapAdminPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("knowledge gap administration", () => {
  it("filters the inbox and shows occurrence and audit details", async () => {
    const requests: URL[] = [];
    server.use(
      http.get("/api/v1/knowledge-gaps", ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ items: [gap], page: 1, pageSize: 20, total: 1 });
      }),
      http.get(`/api/v1/knowledge-gaps/${gap.id}`, () =>
        HttpResponse.json({
          ...gap,
          occurrences: [
            {
              interactionId: "00000000-0000-4000-8000-000000000201",
              question: "Como consigo outra via?",
              occurredAt: "2026-07-30T12:00:00.000Z"
            }
          ],
          events: [
            {
              id: "00000000-0000-4000-8000-000000000301",
              type: "reopened",
              fromStatus: "dismissed",
              toStatus: "open",
              adminId: "00000000-0000-4000-8000-000000000001",
              reason: "A dúvida voltou a ocorrer.",
              createdAt: "2026-07-30T13:00:00.000Z"
            }
          ]
        })
      )
    );
    renderPage();

    expect(await screen.findByRole("heading", { name: /perguntas sem resposta/i })).toBeVisible();
    expect(await screen.findByText("2 ocorrências")).toBeVisible();
    await userEvent.selectOptions(screen.getByLabelText(/status/i), "open");
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("status")).toBe("open"));

    await userEvent.click(screen.getByRole("button", { name: /ver detalhes/i }));
    expect(await screen.findByText("Como consigo outra via?")).toBeVisible();
    expect(screen.getByText("A dúvida voltou a ocorrer.")).toBeVisible();
    expect(screen.getByRole("link", { name: /responder pergunta/i })).toHaveAttribute(
      "href",
      `/admin/faqs?knowledgeGapId=${gap.id}`
    );
  });

  it("renders an actionable empty state", async () => {
    server.use(
      http.get("/api/v1/knowledge-gaps", () =>
        HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 })
      )
    );
    renderPage();

    expect(await screen.findByText(/nenhuma pergunta sem resposta/i)).toBeVisible();
  });

  it("synchronizes category, date, frequency, and page controls with the inbox query", async () => {
    const requests: URL[] = [];
    server.use(
      http.get("/api/v1/categories", () =>
        HttpResponse.json([
          {
            id: "00000000-0000-4000-8000-000000000010",
            name: "Financeiro",
            slug: "financeiro",
            isActive: true,
            createdAt: "2026-07-30T12:00:00.000Z",
            updatedAt: "2026-07-30T12:00:00.000Z"
          }
        ])
      ),
      http.get("/api/v1/knowledge-gaps", ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ items: [gap], page: 1, pageSize: 20, total: 25 });
      })
    );
    renderPage();

    await screen.findByText("2 ocorrências");
    await userEvent.selectOptions(screen.getByLabelText(/categoria/i), [
      "00000000-0000-4000-8000-000000000010"
    ]);
    await userEvent.type(screen.getByLabelText(/data inicial/i), "2026-07-01");
    await userEvent.type(screen.getByLabelText(/data final/i), "2026-07-31");
    await userEvent.clear(screen.getByLabelText(/frequência mínima/i));
    await userEvent.type(screen.getByLabelText(/frequência mínima/i), "2");
    await userEvent.click(screen.getByRole("button", { name: /próxima página/i }));

    await waitFor(() => expect(requests.at(-1)?.searchParams.get("page")).toBe("2"));
    const query = requests.at(-1)!.searchParams;
    expect(query.get("categoryId")).toBe("00000000-0000-4000-8000-000000000010");
    expect(query.get("from")).toBe("2026-07-01");
    expect(query.get("to")).toBe("2026-07-31");
    expect(query.get("minFrequency")).toBe("2");
    expect(query.get("page")).toBe("2");
  });

  it("dismisses an open gap with a reason and then offers reopening", async () => {
    let currentGap = { ...gap };
    server.use(
      http.get("/api/v1/knowledge-gaps", () =>
        HttpResponse.json({ items: [currentGap], page: 1, pageSize: 20, total: 1 })
      ),
      http.get(`/api/v1/knowledge-gaps/${gap.id}`, () =>
        HttpResponse.json({ ...currentGap, occurrences: [], events: [] })
      ),
      http.post(`/api/v1/knowledge-gaps/${gap.id}/dismiss`, async ({ request }) => {
        expect(request.headers.get("idempotency-key")).toBeTruthy();
        expect(await request.json()).toEqual({
          reason: "Não pertence ao escopo do atendimento.",
          expectedVersion: 2
        });
        currentGap = { ...currentGap, status: "dismissed", version: 3 };
        return HttpResponse.json(currentGap);
      })
    );
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /ver detalhes/i }));
    await userEvent.click(await screen.findByRole("button", { name: /descartar pendência/i }));
    await userEvent.type(
      screen.getByLabelText(/justificativa do descarte/i),
      "Não pertence ao escopo do atendimento."
    );
    await userEvent.click(screen.getByRole("button", { name: /confirmar descarte/i }));

    expect(await screen.findByRole("button", { name: /reabrir pendência/i })).toBeVisible();
  });

  it("retries a failed resolution and reports a stale conflict without losing context", async () => {
    const failedGap = {
      ...gap,
      version: 4,
      currentResolution: {
        id: "00000000-0000-4000-8000-000000000301",
        knowledgeGapId: gap.id,
        mode: "create",
        faqId: "00000000-0000-4000-8000-000000000302",
        faqStatus: "embedding_failed",
        status: "failed",
        errorCode: "EMBEDDING_FAILED",
        createdAt: "2026-07-30T12:00:00.000Z",
        completedAt: "2026-07-30T12:01:00.000Z"
      },
      occurrences: [],
      events: []
    };
    server.use(
      http.get("/api/v1/knowledge-gaps", () =>
        HttpResponse.json({ items: [failedGap], page: 1, pageSize: 20, total: 1 })
      ),
      http.get(`/api/v1/knowledge-gaps/${gap.id}`, () => HttpResponse.json(failedGap)),
      http.post(`/api/v1/knowledge-gaps/${gap.id}/resolution-retries`, () =>
        HttpResponse.json(
          {
            code: "KNOWLEDGE_GAP_VERSION_CONFLICT",
            message: "The knowledge gap changed.",
            requestId: "request-1"
          },
          { status: 409 }
        )
      )
    );
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /ver detalhes/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: /tentar resolução novamente/i })
    );
    expect(
      await screen.findByText(/a pendência mudou.*recarregue os dados/i)
    ).toBeVisible();
    expect(screen.getAllByText(gap.representativeQuestion)).toHaveLength(2);
  });
});
