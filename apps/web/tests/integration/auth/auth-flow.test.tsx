import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { LoginPage } from "../../../src/features/auth/login-page.js";
import { ProtectedRoute } from "../../../src/features/auth/protected-route.js";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderRoutes(initialPath: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<h1>Área administrativa</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("administrator authentication UI", () => {
  it("redirects an anonymous administrator to login", async () => {
    server.use(http.get("/api/v1/auth/session", () => new HttpResponse(null, { status: 401 })));
    renderRoutes("/admin");
    expect(await screen.findByRole("heading", { name: /acesso administrativo/i })).toBeVisible();
  });

  it("validates credentials and navigates after login", async () => {
    server.use(
      http.post("/api/v1/auth/login", () => new HttpResponse(null, { status: 204 })),
      http.get("/api/v1/auth/session", () =>
        HttpResponse.json({
          admin: { id: "admin-1", email: "admin@example.com", displayName: "FAQ Admin" },
          csrfToken: "csrf"
        })
      )
    );
    renderRoutes("/login");

    await userEvent.type(screen.getByLabelText(/e-mail/i), "admin@example.com");
    await userEvent.type(screen.getByLabelText(/senha/i), "change-this-password");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByRole("heading", { name: /área administrativa/i })).toBeVisible();
  });
});
