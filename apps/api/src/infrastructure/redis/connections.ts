import { Redis, type RedisOptions } from "ioredis";

const sharedOptions: RedisOptions = {
  lazyConnect: true,
  enableReadyCheck: true,
  maxRetriesPerRequest: 1
};

export function createCacheRedis(url: string): Redis {
  return new Redis(url, {
    ...sharedOptions,
    connectTimeout: 1_000,
    commandTimeout: 500,
    retryStrategy: () => null
  });
}

export function createQueueRedis(url: string): Redis {
  return new Redis(url, {
    ...sharedOptions,
    maxRetriesPerRequest: null,
    retryStrategy: (attempt: number) => Math.min(attempt * 250, 5_000)
  });
}
