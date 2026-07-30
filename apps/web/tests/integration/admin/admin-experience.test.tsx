import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AdminHeader } from "../../../src/features/admin/admin-header.js";
import { ArchitectureWalkthroughPage } from "../../../src/features/admin/architecture-walkthrough-page.js";

describe("administrator experience", () => {
  it("provides one consistent navigation header including queue operations", () => {
    render(
      <MemoryRouter initialEntries={["/admin/faqs"]}>
        <AdminHeader />
      </MemoryRouter>
    );

    const navigation = screen.getByRole("navigation", { name: "Administração" });
    expect(within(navigation).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/admin"
    );
    expect(within(navigation).getByRole("link", { name: "Base de conhecimento" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(within(navigation).getByRole("link", { name: "Sem resposta" })).toHaveAttribute(
      "href",
      "/admin/knowledge-gaps"
    );
    expect(within(navigation).getByRole("link", { name: /Filas/ })).toHaveAttribute(
      "href",
      "/admin/queues/"
    );
    expect(
      within(navigation).queryByRole("link", { name: /walkthrough/i })
    ).not.toBeInTheDocument();
  });

  it("explains the complete system flow and the motivation behind each boundary", () => {
    render(
      <MemoryRouter>
        <ArchitectureWalkthroughPage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "Como o FAQ Intelligence funciona" })
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("walkthrough-step")).toHaveLength(6);
    expect(screen.getByText("1. A pergunta entra como uma conversa")).toBeInTheDocument();
    expect(screen.getByText("6. O ciclo de melhoria fecha no administrador")).toBeInTheDocument();
    expect(screen.getByText("Por que esta arquitetura?")).toBeInTheDocument();
  });
});
