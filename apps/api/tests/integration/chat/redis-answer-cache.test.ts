import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCacheRedis } from "../../../src/infrastructure/redis/connections.js";
import { RedisAnswerCache } from "../../../src/modules/chat/adapters/outbound/redis-answer-cache.js";
import { startTestEnvironment, type TestEnvironment } from "../../helpers/test-environment.js";

const integration = process.env.RUN_INTEGRATION === "true" ? describe : describe.skip;

integration("RedisAnswerCache", () => {
  let environment: TestEnvironment;
  let cache: RedisAnswerCache;

  beforeAll(async () => {
    environment = await startTestEnvironment();
    const redis = createCacheRedis(environment.cacheRedisUrl);
    await redis.connect();
    cache = new RedisAnswerCache(redis, { positiveTtlSeconds: 900, negativeTtlSeconds: 120 });
  }, 120_000);

  afterAll(async () => environment?.stop());

  it("stores a positive answer under its knowledge-versioned key", async () => {
    const value = {
      status: "answered" as const,
      candidate: {
        id: "faq-1",
        canonicalQuestion: "Pergunta",
        answer: "Resposta",
        category: { id: "category-1", name: "Conta" },
        confidence: 1
      }
    };
    await cache.set("faq-answer:v1:2:all:key", value);
    await expect(cache.get("faq-answer:v1:2:all:key")).resolves.toEqual(value);
    await expect(cache.get("faq-answer:v1:3:all:key")).resolves.toBeNull();
  });
});
