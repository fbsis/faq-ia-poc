import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FaqAdminPage } from "../../../src/features/faq-admin/faq-admin-page.js";

const server = setupServer();
const category = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Conta",
  slug: "conta",
  isActive: true,
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z"
};
const faq = {
  id: "00000000-0000-4000-8000-000000000002",
  category: { id: category.id, name: category.name },
  question: "Como redefino minha senha?",
  aliases: ["Esqueci minha senha"],
  answer: "Use o link enviado por e-mail.",
  status: "embedding_failed",
  embeddingError: "provider timeout",
  contentVersion: 1,
  createdAt: "2026-07-30T12:00:00.000Z",
  updatedAt: "2026-07-30T12:00:00.000Z"
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <FaqAdminPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("FAQ administration", () => {
  it("lists statuses and retries a failed embedding", async () => {
    let retried = false;
    server.use(
      http.get("/api/v1/categories", () => HttpResponse.json([category])),
      http.get("/api/v1/faqs", () =>
        HttpResponse.json({ items: [faq], page: 1, pageSize: 20, total: 1 })
      ),
      http.post(`/api/v1/faqs/${faq.id}/embedding-retries`, () => {
        retried = true;
        return HttpResponse.json({ ...faq, status: "embedding_pending", embeddingError: undefined });
      })
    );
    renderPage();

    expect(await screen.findByText(/falha no processamento/i)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /tentar embedding novamente/i }));
    expect(retried).toBe(true);
  });

  it("validates and creates a FAQ from the reusable form", async () => {
    let created = false;
    server.use(
      http.get("/api/v1/categories", () => HttpResponse.json([category])),
      http.get("/api/v1/faqs", () =>
        HttpResponse.json({ items: [], page: 1, pageSize: 20, total: 0 })
      ),
      http.post("/api/v1/faqs", async ({ request }) => {
        created = (await request.json() as { question: string }).question === "Como acesso minha conta?";
        return HttpResponse.json({ ...faq, question: "Como acesso minha conta?", status: "embedding_pending" });
      })
    );
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /nova pergunta/i }));
    await userEvent.type(screen.getByLabelText(/pergunta/i), "Como acesso minha conta?");
    await userEvent.type(screen.getByLabelText(/resposta/i), "Use seu e-mail.");
    await userEvent.click(screen.getByRole("button", { name: /salvar pergunta/i }));
    expect(created).toBe(true);
    expect(await screen.findByText(/processando embedding/i)).toBeVisible();
  });

  it("replaces the pending status automatically when embedding finishes", async () => {
    let requests = 0;
    server.use(
      http.get("/api/v1/categories", () => HttpResponse.json([category])),
      http.get("/api/v1/faqs", () => {
        requests += 1;
        return HttpResponse.json({
          items: [{ ...faq, status: requests === 1 ? "embedding_pending" : "active" }],
          page: 1,
          pageSize: 20,
          total: 1
        });
      })
    );
    renderPage();

    expect(await screen.findByText(/processando embedding/i)).toBeVisible();
    expect(await screen.findByText(/^ativa$/i, {}, { timeout: 2_500 })).toBeVisible();
    expect(requests).toBeGreaterThan(1);
  });

  it("soft-deactivates and offers restoration", async () => {
    let active = true;
    server.use(
      http.get("/api/v1/categories", () => HttpResponse.json([category])),
      http.get("/api/v1/faqs", () =>
        HttpResponse.json({ items: [{ ...faq, status: active ? "active" : "inactive" }], page: 1, pageSize: 20, total: 1 })
      ),
      http.patch(`/api/v1/faqs/${faq.id}/status`, async ({ request }) => {
        active = (await request.json() as { active: boolean }).active;
        return HttpResponse.json({ ...faq, status: active ? "embedding_pending" : "inactive" });
      })
    );
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /desativar/i }));
    expect(await screen.findByRole("button", { name: /restaurar/i })).toBeVisible();
  });
});
