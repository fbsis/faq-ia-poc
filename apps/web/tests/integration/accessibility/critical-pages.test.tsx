import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { LoginPage } from "../../../src/features/auth/login-page.js";
import { ChatPage } from "../../../src/features/chat/chat-page.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithProviders(node: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
        })
      }
    >
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("critical page accessibility", () => {
  it("supports a keyboard-only chat journey with an announced conversation state", async () => {
    server.use(
      http.post("/api/v1/chat/questions", () =>
        HttpResponse.json({
          interactionId: "00000000-0000-4000-8000-000000000010",
          status: "answered",
          message: "Encontrei uma resposta aprovada.",
          answer: "Use a opção **Esqueci minha senha**."
        })
      )
    );
    renderWithProviders(<ChatPage />);

    const input = screen.getByRole("textbox", { name: /digite sua pergunta/i });
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.keyboard("Como redefino minha senha?{Enter}");

    expect(await screen.findByText("Esqueci minha senha")).toBeVisible();
    expect(screen.getByRole("log", { name: /conversa com o assistente/i })).toHaveAttribute(
      "aria-label"
    );
    expect(screen.getByRole("main")).toHaveClass("px-3", "sm:px-6");
  });

  it("exposes labeled login controls, autocomplete intent, and visible keyboard focus targets", () => {
    renderWithProviders(<LoginPage />);

    const email = screen.getByRole("textbox", { name: /e-mail/i });
    const password = screen.getByLabelText(/senha/i);
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByRole("button", { name: /entrar/i })).toHaveClass(
      "focus-visible:outline-none",
      "focus-visible:ring-2"
    );
    expect(screen.getByRole("main")).toHaveClass("px-4");
  });
});
