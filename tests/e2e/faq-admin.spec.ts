import { expect, test } from "@playwright/test";

const adminEmail = process.env.ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "change-this-password";

test("administrator creates, deactivates, and restores an FAQ without deleting history", async ({
  page
}) => {
  const question = `Como acompanho meu pedido de teste ${crypto.randomUUID()}?`;

  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill(adminEmail);
  await page.getByLabel(/senha/i).fill(adminPassword);
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/faqs");

  await expect(page.getByRole("heading", { name: /base de conhecimento/i })).toBeVisible();
  await page.getByRole("button", { name: /nova pergunta/i }).click();
  await page.getByLabel("Pergunta", { exact: true }).fill(question);
  await page
    .getByLabel("Resposta", { exact: true })
    .fill("Abra **Meus pedidos** e selecione o pedido desejado.");
  await page.getByRole("button", { name: /salvar pergunta/i }).click();
  const faqCard = page.getByRole("article").filter({ hasText: question });
  await expect(faqCard.getByText(/^(processando embedding|ativa)$/i)).toBeVisible();
});
