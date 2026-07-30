import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { Queue } from "bullmq";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Environment } from "../config/environment.js";
import type { GetSession } from "../../modules/auth/application/get-session.js";
import { createAuthGuards } from "../../modules/auth/adapters/inbound/http/auth-plugin.js";
import { FAQ_EMBEDDINGS_QUEUE } from "./config.js";

const basePath = "/admin/queues";
const allowedPayloadFields = ["faqId", "contentVersion", "resolutionId"] as const;

export function createBullBoardPolicy(
  environment: Environment["NODE_ENV"],
  mutationsEnabled: boolean
) {
  const readOnlyMode = environment === "production" || !mutationsEnabled;
  return {
    readOnlyMode,
    allowRetries: !readOnlyMode,
    hideRedisDetails: true
  };
}

export function redactQueuePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { redacted: true };
  }
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    allowedPayloadFields
      .filter((field) => source[field] !== undefined)
      .map((field) => [field, source[field]])
  );
}

export async function registerBullBoard(
  app: FastifyInstance,
  dependencies: {
    getSession: GetSession;
    environment: Environment;
    connection?: Redis;
    testMode?: boolean;
  }
): Promise<void> {
  const guards = createAuthGuards(dependencies.getSession);
  await app.register(async (protectedApp) => {
    protectedApp.addHook("onRequest", (request) => guards.requireAdmin(request));

    if (dependencies.testMode || !dependencies.connection) {
      protectedApp.get(basePath, async (_, reply) =>
        reply.type("text/html").send("<h1>Operações das filas</h1>")
      );
      return;
    }

    const policy = createBullBoardPolicy(
      dependencies.environment.NODE_ENV,
      dependencies.environment.BULL_BOARD_MUTATIONS_ENABLED
    );
    const queue = new Queue(FAQ_EMBEDDINGS_QUEUE, {
      connection: dependencies.connection,
      prefix: dependencies.environment.QUEUE_PREFIX
    });
    const queueAdapter = new BullMQAdapter(queue, {
      readOnlyMode: policy.readOnlyMode,
      allowRetries: policy.allowRetries
    });
    queueAdapter.setFormatter("data", redactQueuePayload);
    queueAdapter.setFormatter("returnValue", redactQueuePayload);

    const serverAdapter = new FastifyAdapter();
    serverAdapter.setBasePath(basePath);
    createBullBoard({
      queues: [queueAdapter],
      serverAdapter,
      options: {
        uiConfig: {
          boardTitle: "FAQ Intelligence · Operações das filas",
          hideRedisDetails: policy.hideRedisDetails
        }
      }
    });
    await protectedApp.register(serverAdapter.registerPlugin(), { prefix: basePath });
    protectedApp.addHook("onClose", () => queue.close());
  });
}
