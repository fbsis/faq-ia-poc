import { expect, test } from "@playwright/test";

test("administrator resolves an unanswered question and the chatbot uses the approved answer", async ({
  page
}) => {
  const question = `Como solicitar o documento ${Date.now()}?`;
  const answer = "Acesse **Documentos**, escolha o tipo desejado e confirme a solicitação.";

  await page.goto("/");
  await page.getByLabel(/digite sua pergunta/i).fill(question);
  await page.getByRole("button", { name: /enviar/i }).click();
  await expect(page.getByText(/uma pessoa entrará em contato/i)).toBeVisible();

  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill("admin@example.com");
  await page.getByLabel(/senha/i).fill("change-this-password");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.goto("/admin/knowledge-gaps");

  await expect(page.getByRole("heading", { name: /perguntas sem resposta/i })).toBeVisible();
  await page.getByText(question).click();
  await page.getByRole("button", { name: /ver detalhes/i }).click();
  await page.getByRole("link", { name: /responder pergunta/i }).click();
  await expect(page.getByLabel(/pergunta/i)).toHaveValue(question);
  await page.getByLabel(/resposta/i).fill(answer);
  await page.getByRole("button", { name: /salvar e resolver pergunta/i }).click();

  await expect(page.getByText(/em resolução|resposta em processamento/i)).toBeVisible();
  await expect(page.getByText(/resolvida/i)).toBeVisible({ timeout: 30_000 });

  await page.goto("/");
  await page.getByLabel(/digite sua pergunta/i).fill(question);
  await page.getByRole("button", { name: /enviar/i }).click();
  await expect(page.getByText(/acesse documentos/i)).toBeVisible();
});
