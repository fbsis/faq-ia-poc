import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

export interface TestEnvironment {
  databaseUrl: string;
  cacheRedisUrl: string;
  queueRedisUrl: string;
  stop(): Promise<void>;
}

export async function startTestEnvironment(): Promise<TestEnvironment> {
  const containers = await Promise.all([
    new GenericContainer("pgvector/pgvector:pg17")
      .withEnvironment({
        POSTGRES_DB: "faq_test",
        POSTGRES_USER: "faq",
        POSTGRES_PASSWORD: "faq"
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage(/database system is ready to accept connections/, 2)
      )
      .start(),
    startRedis(),
    startRedis()
  ]);

  const [postgres, cache, queue] = containers;
  return {
    databaseUrl: `postgres://faq:faq@${postgres.getHost()}:${postgres.getMappedPort(5432)}/faq_test`,
    cacheRedisUrl: redisUrl(cache),
    queueRedisUrl: redisUrl(queue),
    async stop() {
      await Promise.all(containers.map((container) => container.stop()));
    }
  };
}

function startRedis(): Promise<StartedTestContainer> {
  return new GenericContainer("redis:8-alpine")
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage(/Ready to accept connections/))
    .start();
}

function redisUrl(container: StartedTestContainer): string {
  return `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
}
