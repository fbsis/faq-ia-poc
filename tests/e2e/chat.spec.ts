import { expect, test } from "@playwright/test";

test("answered, ambiguous, unanswered, and recoverable chat outcomes", async ({ page }) => {
  const attempts = new Map<string, number>();
  await page.route("**/api/v1/chat/questions", async (route) => {
    const request = route.request().postDataJSON() as { question: string };
    const attempt = (attempts.get(request.question) ?? 0) + 1;
    attempts.set(request.question, attempt);

    if (request.question === "Falha temporária" && attempt === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "SERVICE_UNAVAILABLE",
          message: "Tente novamente.",
          requestId: "e2e-request"
        })
      });
      return;
    }

    const response =
      request.question === "Como redefino minha senha?"
        ? {
            interactionId: "00000000-0000-4000-8000-000000000010",
            status: "answered",
            message: "Resposta aprovada.",
            answer: "Use **Esqueci minha senha** na tela de login."
          }
        : request.question === "Talvez seja acesso"
          ? {
              interactionId: "00000000-0000-4000-8000-000000000011",
              status: "ambiguous",
              message: "Esta opção representa sua dúvida?",
              suggestions: ["Como recuperar o acesso à conta?"]
            }
          : {
              interactionId: "00000000-0000-4000-8000-000000000012",
              status: "unanswered",
              message: "Em qual etapa isso aconteceu?"
            };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response)
    });
  });

  await page.goto("/");
  const composer = page.getByLabel(/digite sua pergunta/i);

  await composer.fill("Como redefino minha senha?");
  await page.getByRole("button", { name: /enviar pergunta/i }).click();
  await expect(page.getByText("Esqueci minha senha", { exact: true })).toBeVisible();

  await composer.fill("Talvez seja acesso");
  await page.getByRole("button", { name: /enviar pergunta/i }).click();
  await expect(page.getByText("Como recuperar o acesso à conta?")).toBeVisible();

  await composer.fill("Pergunta desconhecida");
  await page.getByRole("button", { name: /enviar pergunta/i }).click();
  await expect(page.getByText("Em qual etapa isso aconteceu?")).toBeVisible();

  await composer.fill("Falha temporária");
  await page.getByRole("button", { name: /enviar pergunta/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: /tentar novamente/i }).click();
  await expect(page.getByText("Em qual etapa isso aconteceu?").last()).toBeVisible();
  await expect(composer).toHaveValue("");
});
