import { expect, test } from "@playwright/test";

test("administrator filters analytics and sees historical unanswered separate from backlog", async ({
  page
}) => {
  const requestedRanges: string[] = [];
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        admin: { id: "admin-1", email: "admin@example.com", displayName: "FAQ Admin" },
        csrfToken: "csrf"
      })
    })
  );
  await page.route("**/api/v1/analytics/summary?**", (route) => {
    requestedRanges.push(route.request().url());
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(summary)
    });
  });

  await page.goto("/admin?from=2026-07-01&to=2026-07-31");

  await expect(page.getByRole("heading", { name: /visão geral/i })).toBeVisible();
  await expect(page.getByText("4", { exact: true })).toBeVisible();
  await expect(page.getByText(/2 pendências abertas/i)).toBeVisible();

  await page.getByLabel(/data inicial/i).fill("2026-06-01");
  await page.getByLabel(/data final/i).fill("2026-06-30");
  await page.getByRole("button", { name: /aplicar período/i }).click();

  await expect(page).toHaveURL(/from=2026-06-01&to=2026-06-30/);
  expect(requestedRanges.some((url) => url.includes("from=2026-06-01"))).toBe(true);
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
  knowledgeGapBacklog: { open: 2, resolving: 0, resolved: 1, dismissed: 0 },
  topQuestions: [{ question: "Como redefino minha senha?", count: 5 }],
  unansweredQuestions: [
    {
      question: "Como altero meu cadastro?",
      count: 4,
      lastOccurredAt: "2026-07-30T12:00:00.000Z"
    }
  ],
  categoryDistribution: [{ categoryName: "Sem categoria", count: 12 }],
  timeline: [{ date: "2026-07-30", count: 12 }]
};
