import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "change-this-password";

test("administrator resolves an unanswered question and the chatbot uses the approved answer", async ({
  page
}) => {
  const question = `Como catalogar o sinal ${crypto.randomUUID()} da baleia no anel de Saturno?`;
  const answer = "Abra **Catálogo**, selecione o sinal da baleia e confirme o anel de Saturno.";

  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill(adminEmail);
  await page.getByLabel(/senha/i).fill(adminPassword);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await deactivateMatchingFaqs(page, question, answer);

  await page.goto("/");
  await page.getByLabel(/digite sua pergunta/i).fill(question);
  await page.getByRole("button", { name: /enviar/i }).click();
  await expect(page.getByText(/não sei responder essa pergunta com segurança/i)).toBeVisible({
    timeout: 20_000
  });

  await page.goto("/admin/knowledge-gaps");

  await expect(page.getByRole("heading", { name: /perguntas sem resposta/i })).toBeVisible();
  const gapCard = page.getByRole("article").filter({ hasText: question });
  await gapCard.getByRole("button", { name: /ver detalhes/i }).click();
  await page.getByRole("link", { name: /responder pergunta/i }).click();
  await expect(page.getByLabel("Pergunta", { exact: true })).toHaveValue(question);
  await page.getByLabel("Resposta", { exact: true }).fill(answer);
  await page.getByRole("button", { name: /salvar e resolver pergunta/i }).click();

  const updatedGapCard = page.getByRole("article").filter({ hasText: question });
  await expect(updatedGapCard.getByText("Resolvida", { exact: true })).toBeVisible({
    timeout: 30_000
  });

  await page.goto("/");
  await page.getByLabel(/digite sua pergunta/i).fill(question);
  await page.getByRole("button", { name: /enviar/i }).click();
  await expect(page.getByText(/abra catálogo/i)).toBeVisible({ timeout: 20_000 });
  await deactivateMatchingFaqs(page, question, answer);
});

async function deactivateMatchingFaqs(page: Page, question: string, answer: string) {
  const request = page.context().request;
  const sessionResponse = await request.get("/api/v1/auth/session");
  expect(sessionResponse.ok()).toBe(true);
  const session = (await sessionResponse.json()) as { csrfToken: string };
  let currentPage = 1;
  let total = 0;

  do {
    const response = await request.get(`/api/v1/faqs?page=${currentPage}&pageSize=100`);
    expect(response.ok()).toBe(true);
    const result = (await response.json()) as {
      items: Array<{ id: string; question: string; answer: string; status: string }>;
      total: number;
    };
    total = result.total;
    for (const faq of result.items) {
      const belongsToScenario = faq.question === question || faq.answer === answer;
      if (!belongsToScenario || faq.status === "inactive") continue;
      const statusResponse = await request.patch(`/api/v1/faqs/${faq.id}/status`, {
        data: { active: false },
        headers: { "x-csrf-token": session.csrfToken }
      });
      expect(statusResponse.ok()).toBe(true);
    }
    currentPage += 1;
  } while ((currentPage - 1) * 100 < total);
}
