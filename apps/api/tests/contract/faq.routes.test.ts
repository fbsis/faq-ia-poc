import { categorySchema, errorEnvelopeSchema, faqPageSchema, faqSchema } from "@faq/contracts";
import { describe, expect, it } from "vitest";
import { buildApplication } from "../../src/bootstrap/build-application.js";

describe("FAQ administration HTTP contract", () => {
  it("rejects anonymous access", async () => {
    const app = await buildApplication({ mode: "test" });
    expect((await app.inject({ method: "GET", url: "/api/v1/faqs" })).statusCode).toBe(401);
    await app.close();
  });

  it("creates a category and an embedding-pending FAQ for an administrator", async () => {
    const app = await buildApplication({ mode: "test" });
    const auth = await login(app);
    const categoryResponse = await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      headers: auth,
      payload: { name: "Conta" }
    });
    const category = categorySchema.parse(categoryResponse.json());
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/faqs",
      headers: auth,
      payload: {
        categoryId: category.id,
        question: "Como redefino minha senha?",
        aliases: ["Esqueci minha senha"],
        answer: "Use o link enviado por e-mail."
      }
    });

    expect(categoryResponse.statusCode).toBe(201);
    expect(response.statusCode).toBe(202);
    expect(faqSchema.parse(response.json()).status).toBe("embedding_pending");
    expect(
      faqPageSchema.parse(
        (
          await app.inject({
            method: "GET",
            url: "/api/v1/faqs?page=1&pageSize=20",
            headers: { cookie: auth.cookie }
          })
        ).json()
      ).total
    ).toBe(1);
    await app.close();
  });

  it("validates input and requires CSRF for mutations", async () => {
    const app = await buildApplication({ mode: "test" });
    const auth = await login(app);
    const noCsrf = await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      headers: { cookie: auth.cookie },
      payload: { name: "Conta" }
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      headers: auth,
      payload: { name: "A" }
    });
    expect(noCsrf.statusCode).toBe(403);
    expect(errorEnvelopeSchema.parse(invalid.json()).code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("soft-deactivates and restores an existing FAQ", async () => {
    const app = await buildApplication({ mode: "test" });
    const auth = await login(app);
    const category = categorySchema.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/categories",
          headers: auth,
          payload: { name: "Conta" }
        })
      ).json()
    );
    const faq = faqSchema.parse(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/faqs",
          headers: auth,
          payload: {
            categoryId: category.id,
            question: "Como redefino minha senha?",
            answer: "Use o link enviado por e-mail."
          }
        })
      ).json()
    );

    const inactive = await app.inject({
      method: "PATCH",
      url: `/api/v1/faqs/${faq.id}/status`,
      headers: auth,
      payload: { active: false }
    });
    const restored = await app.inject({
      method: "PATCH",
      url: `/api/v1/faqs/${faq.id}/status`,
      headers: auth,
      payload: { active: true }
    });

    expect(faqSchema.parse(inactive.json()).status).toBe("inactive");
    expect(faqSchema.parse(restored.json())).toMatchObject({
      status: "embedding_pending",
      contentVersion: 2
    });
    await app.close();
  });
});

async function login(app: Awaited<ReturnType<typeof buildApplication>>) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: "admin@example.com", password: "change-this-password" }
  });
  const value = response.headers["set-cookie"];
  return {
    cookie: Array.isArray(value) ? value[0]! : value!,
    "x-csrf-token": String(response.headers["x-csrf-token"])
  };
}
