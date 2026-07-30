import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ChatPage } from "../../../src/features/chat/chat-page.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatPage />
    </QueryClientProvider>
  );
}

describe("unanswered chat", () => {
  it("shows contextual guidance without presenting an unapproved answer", async () => {
    server.use(
      http.post("/api/v1/chat/questions", () =>
        HttpResponse.json({
          interactionId: "00000000-0000-4000-8000-000000000010",
          status: "unanswered",
          message:
            "Não encontrei uma resposta segura. Em qual etapa do cadastro surgiu essa dúvida?"
        })
      )
    );
    renderPage();

    await userEvent.type(screen.getByLabelText(/digite sua pergunta/i), "Meu cadastro parou");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));

    expect(await screen.findByText(/em qual etapa do cadastro/i)).toBeVisible();
    expect(screen.getByText(/preciso de mais contexto/i)).toBeVisible();
    expect(screen.queryByText(/resposta baseada na faq aprovada/i)).not.toBeInTheDocument();
  });

  it("presents an ambiguous approved suggestion as a question, not an answer", async () => {
    server.use(
      http.post("/api/v1/chat/questions", () =>
        HttpResponse.json({
          interactionId: "00000000-0000-4000-8000-000000000011",
          status: "ambiguous",
          message: "Encontrei uma opção parecida. Ela representa sua dúvida?",
          suggestions: ["Como recuperar o acesso à conta?"]
        })
      )
    );
    renderPage();

    await userEvent.type(screen.getByLabelText(/digite sua pergunta/i), "Não consigo entrar");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));

    expect(await screen.findByText(/ela representa sua dúvida/i)).toBeVisible();
    expect(screen.getByText("Como recuperar o acesso à conta?")).toBeVisible();
    expect(screen.getByText(/encontrei uma possibilidade/i)).toBeVisible();
  });

  it("sends previous unanswered outcomes so repeated misses can be handed to a person", async () => {
    const requests: Array<{
      question: string;
      history?: Array<{ role: string; content: string; status?: string }>;
    }> = [];
    server.use(
      http.post("/api/v1/chat/questions", async ({ request }) => {
        requests.push(
          (await request.json()) as {
            question: string;
            history?: Array<{ role: string; content: string; status?: string }>;
          }
        );
        return HttpResponse.json({
          interactionId:
            requests.length === 1
              ? "00000000-0000-4000-8000-000000000013"
              : "00000000-0000-4000-8000-000000000014",
          status: "unanswered",
          message:
            requests.length === 1
              ? "Você pode explicar melhor?"
              : "Ainda não encontrei essa informação."
        });
      })
    );
    renderPage();
    const input = screen.getByLabelText(/digite sua pergunta/i);

    await userEvent.type(input, "Primeira forma da dúvida");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));
    await screen.findByText("Você pode explicar melhor?");

    await userEvent.type(input, "Segunda forma da dúvida");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));
    await screen.findByText("Ainda não encontrei essa informação.");

    expect(requests[1]?.history).toEqual([
      { role: "user", content: "Primeira forma da dúvida" },
      {
        role: "assistant",
        content: "Você pode explicar melhor?",
        status: "unanswered"
      }
    ]);
  });

  it("keeps one failed turn and clears the composer only after a successful retry", async () => {
    let attempts = 0;
    server.use(
      http.post("/api/v1/chat/questions", () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json(
              {
                code: "SERVICE_UNAVAILABLE",
                message: "Tente novamente.",
                requestId: "request-1"
              },
              { status: 503 }
            )
          : HttpResponse.json({
              interactionId: "00000000-0000-4000-8000-000000000012",
              status: "unanswered",
              message: "Em qual etapa isso aconteceu?"
            });
      })
    );
    renderPage();
    const input = screen.getByLabelText(/digite sua pergunta/i);

    await userEvent.type(input, "Minha pergunta permanece");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(input).toHaveValue("Minha pergunta permanece");

    await userEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));

    expect(await screen.findByText(/em qual etapa isso aconteceu/i)).toBeVisible();
    expect(input).toHaveValue("");
    expect(screen.getAllByText("Minha pergunta permanece", { exact: true })).toHaveLength(1);
    expect(attempts).toBe(2);
  });
});
