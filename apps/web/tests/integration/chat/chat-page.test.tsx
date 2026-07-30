import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
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

describe("public FAQ chat", () => {
  it("submits a question and announces the approved answer", async () => {
    server.use(
      http.post("/api/v1/chat/questions", () =>
        HttpResponse.json({
          interactionId: "00000000-0000-4000-8000-000000000010",
          status: "answered",
          message: "Encontrei uma resposta aprovada.",
          answer: "Na tela de login, selecione “Esqueci minha senha”.",
          matchedQuestion: "Como redefino minha senha?",
          category: {
            id: "00000000-0000-4000-8000-000000000001",
            name: "Conta"
          }
        })
      )
    );
    renderPage();

    await userEvent.type(
      screen.getByLabelText(/digite sua pergunta/i),
      "Como redefino minha senha?"
    );
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));

    expect(await screen.findByText(/esqueci minha senha/i)).toBeVisible();
    expect(screen.getByText("Conta")).toBeVisible();
  });

  it("disables duplicate submission while waiting", async () => {
    server.use(
      http.post("/api/v1/chat/questions", async () => {
        await delay(200);
        return HttpResponse.json({
          interactionId: "00000000-0000-4000-8000-000000000010",
          status: "answered",
          message: "Ok",
          answer: "Resposta"
        });
      })
    );
    renderPage();

    await userEvent.type(screen.getByLabelText(/digite sua pergunta/i), "Pergunta válida");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));

    expect(screen.getByRole("button", { name: /consultando/i })).toBeDisabled();
  });

  it("keeps the question and offers retry after a recoverable error", async () => {
    server.use(
      http.post("/api/v1/chat/questions", () =>
        HttpResponse.json(
          {
            code: "SERVICE_UNAVAILABLE",
            message: "Tente novamente.",
            requestId: "request-1"
          },
          { status: 503 }
        )
      )
    );
    renderPage();
    const input = screen.getByLabelText(/digite sua pergunta/i);

    await userEvent.type(input, "Minha pergunta permanece");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/tente novamente/i);
    expect(input).toHaveValue("Minha pergunta permanece");
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeVisible();
  });
});
