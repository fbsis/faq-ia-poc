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
  it("starts with an assistant greeting inside a conversation log", () => {
    renderPage();

    const conversation = screen.getByRole("log", { name: /conversa com o assistente/i });
    expect(conversation).toHaveTextContent(/olá/i);
    expect(conversation).toHaveTextContent(/como posso ajudar/i);
  });

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

    expect(screen.getByText("Como redefino minha senha?", { exact: true })).toBeVisible();
    expect(await screen.findByText(/esqueci minha senha/i)).toBeVisible();
    expect(screen.getByText("Conta")).toBeVisible();
    expect(screen.getByLabelText(/digite sua pergunta/i)).toHaveValue("");
  });

  it("renders GitHub-flavored Markdown in assistant messages", async () => {
    server.use(
      http.post("/api/v1/chat/questions", () =>
        HttpResponse.json({
          interactionId: "00000000-0000-4000-8000-000000000010",
          status: "answered",
          message: "Resposta fundamentada.",
          answer:
            "**Para redefinir:**\n\n1. Abra a tela de login.\n2. Clique em [Esqueci minha senha](https://example.com/reset)."
        })
      )
    );
    renderPage();

    await userEvent.type(screen.getByLabelText(/digite sua pergunta/i), "Como redefino?");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));

    expect(await screen.findByText("Para redefinir:")).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /esqueci minha senha/i })).toHaveAttribute(
      "href",
      "https://example.com/reset"
    );
  });

  it("keeps previous user and assistant messages in the visible conversation", async () => {
    server.use(
      http.post("/api/v1/chat/questions", async ({ request }) => {
        const body = (await request.json()) as { question: string };
        return HttpResponse.json({
          interactionId:
            body.question === "Primeira pergunta"
              ? "00000000-0000-4000-8000-000000000010"
              : "00000000-0000-4000-8000-000000000011",
          status: "answered",
          message: "Encontrei uma resposta aprovada.",
          answer:
            body.question === "Primeira pergunta"
              ? "Resposta da primeira pergunta"
              : "Resposta da segunda pergunta"
        });
      })
    );
    renderPage();
    const input = screen.getByLabelText(/digite sua pergunta/i);

    await userEvent.type(input, "Primeira pergunta");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));
    expect(await screen.findByText("Resposta da primeira pergunta")).toBeVisible();

    await userEvent.type(input, "Segunda pergunta");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));

    expect(await screen.findByText("Resposta da segunda pergunta")).toBeVisible();
    expect(screen.getByText("Primeira pergunta", { exact: true })).toBeVisible();
    expect(screen.getByText("Resposta da primeira pergunta")).toBeVisible();
    expect(screen.getByText("Segunda pergunta", { exact: true })).toBeVisible();
  });

  it("sends completed turns as bounded context for a follow-up question", async () => {
    const requests: unknown[] = [];
    server.use(
      http.post("/api/v1/chat/questions", async ({ request }) => {
        const body = (await request.json()) as {
          question: string;
          history?: Array<{ role: string; content: string }>;
        };
        requests.push(body);
        return HttpResponse.json({
          interactionId:
            requests.length === 1
              ? "00000000-0000-4000-8000-000000000010"
              : "00000000-0000-4000-8000-000000000011",
          status: "answered",
          message: "Resposta fundamentada.",
          answer:
            requests.length === 1
              ? "Você pode redefinir sua senha pela tela de login."
              : "Sem acesso ao e-mail, procure o suporte cadastral."
        });
      })
    );
    renderPage();
    const input = screen.getByLabelText(/digite sua pergunta/i);

    await userEvent.type(input, "Como redefino minha senha?");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));
    await screen.findByText(/você pode redefinir/i);

    await userEvent.type(input, "E se eu não tiver acesso ao e-mail?");
    await userEvent.click(screen.getByRole("button", { name: /enviar pergunta/i }));
    await screen.findByText(/procure o suporte cadastral/i);

    expect(requests[1]).toEqual({
      question: "E se eu não tiver acesso ao e-mail?",
      history: [
        { role: "user", content: "Como redefino minha senha?" },
        {
          role: "assistant",
          content: "Você pode redefinir sua senha pela tela de login."
        }
      ]
    });
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
