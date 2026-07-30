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
const server = setupServer();

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
});
