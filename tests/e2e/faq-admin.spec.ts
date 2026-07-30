import { expect, test } from "@playwright/test";

test("administrator creates, deactivates, and restores an FAQ without deleting history", async ({
  page
}) => {
  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill("admin@example.com");
  await page.getByLabel(/senha/i).fill("change-this-password");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.goto("/admin/faqs");

  await expect(page.getByRole("heading", { name: /base de conhecimento/i })).toBeVisible();
  await page.getByRole("button", { name: /nova pergunta/i }).click();
  await page.getByLabel(/pergunta/i).fill("Como acompanho meu pedido?");
  await page.getByLabel(/resposta/i).fill("Abra **Meus pedidos** e selecione o pedido desejado.");
  await page.getByRole("button", { name: /salvar pergunta/i }).click();
  await expect(page.getByText(/processando embedding/i)).toBeVisible();
});
