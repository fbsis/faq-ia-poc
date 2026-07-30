import {
  categoryInputSchema,
  categorySchema,
  faqIdParamsSchema,
  faqInputSchema,
  faqListQuerySchema,
  faqPageSchema,
  faqSchema,
  faqStatusInputSchema
} from "@faq/contracts";
import type { FastifyInstance } from "fastify";
import type { GetSession } from "../../../../auth/application/get-session.js";
import { createAuthGuards } from "../../../../auth/adapters/inbound/http/auth-plugin.js";
import type { createFaqUseCases } from "../../../application/faq-use-cases.js";
import type { FaqEntry } from "../../../domain/faq-entry.js";

type FaqUseCases = ReturnType<typeof createFaqUseCases>;

export function registerFaqRoutes(
  app: FastifyInstance,
  dependencies: { getSession: GetSession; useCases: FaqUseCases }
): void {
  const guards = createAuthGuards(dependencies.getSession);
  const admin = (request: Parameters<typeof guards.requireAdmin>[0]) =>
    guards.requireAdmin(request);
  const mutation = (request: Parameters<typeof guards.requireCsrf>[0]) =>
    guards.requireCsrf(request);

  app.get("/api/v1/categories", { preHandler: admin }, async () =>
    (await dependencies.useCases.listCategories()).map((category) =>
      categorySchema.parse(serializeCategory(category))
    )
  );
  app.post("/api/v1/categories", { preHandler: mutation }, async (request, reply) => {
    const category = await dependencies.useCases.createCategory(
      categoryInputSchema.parse(request.body)
    );
    return reply.status(201).send(categorySchema.parse(serializeCategory(category)));
  });

  app.get("/api/v1/faqs", { preHandler: admin }, async (request) =>
    faqPageSchema.parse(
      await dependencies.useCases.listFaqs(faqListQuerySchema.parse(request.query))
    )
  );
  app.post("/api/v1/faqs", { preHandler: mutation }, async (request, reply) => {
    const faq = await dependencies.useCases.createFaq(faqInputSchema.parse(request.body));
    return reply.status(202).send(await serializeFaq(faq, dependencies.useCases));
  });
  app.get("/api/v1/faqs/:faqId", { preHandler: admin }, async (request) => {
    const { faqId } = faqIdParamsSchema.parse(request.params);
    return serializeFaq(await dependencies.useCases.getFaq(faqId), dependencies.useCases);
  });
  app.patch("/api/v1/faqs/:faqId", { preHandler: mutation }, async (request, reply) => {
    const { faqId } = faqIdParamsSchema.parse(request.params);
    const faq = await dependencies.useCases.updateFaq(faqId, faqInputSchema.parse(request.body));
    return reply.status(202).send(await serializeFaq(faq, dependencies.useCases));
  });
  app.patch("/api/v1/faqs/:faqId/status", { preHandler: mutation }, async (request, reply) => {
    const { faqId } = faqIdParamsSchema.parse(request.params);
    const { active } = faqStatusInputSchema.parse(request.body);
    const faq = await dependencies.useCases.changeStatus(faqId, active);
    return reply.status(202).send(await serializeFaq(faq, dependencies.useCases));
  });
  app.post(
    "/api/v1/faqs/:faqId/embedding-retries",
    { preHandler: mutation },
    async (request, reply) => {
      const { faqId } = faqIdParamsSchema.parse(request.params);
      const faq = await dependencies.useCases.retryEmbedding(faqId);
      return reply.status(202).send(await serializeFaq(faq, dependencies.useCases));
    }
  );
}

function serializeCategory(category: {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...category,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString()
  };
}

async function serializeFaq(faq: FaqEntry, useCases: FaqUseCases) {
  const category = (await useCases.listCategories()).find((item) => item.id === faq.categoryId);
  return faqSchema.parse({
    id: faq.id,
    category: { id: faq.categoryId, name: category?.name ?? "Sem categoria" },
    question: faq.question,
    aliases: faq.aliases,
    answer: faq.answer,
    status: faq.status,
    contentVersion: faq.contentVersion,
    embeddingError: faq.embeddingError,
    createdAt: faq.createdAt.toISOString(),
    updatedAt: faq.updatedAt.toISOString()
  });
}
