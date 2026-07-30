import type { Redis } from "ioredis";
import type { AnswerCache, CachedAnswer } from "../../application/ports.js";

interface CacheOptions {
  positiveTtlSeconds: number;
  negativeTtlSeconds: number;
}

export class RedisAnswerCache implements AnswerCache {
  constructor(
    private readonly redis: Redis,
    private readonly options: CacheOptions = {
      positiveTtlSeconds: 900,
      negativeTtlSeconds: 120
    }
  ) {}

  async get(key: string): Promise<CachedAnswer | null> {
    const value = await this.redis.get(key);
    return value ? (JSON.parse(value) as CachedAnswer) : null;
  }

  async set(key: string, value: CachedAnswer): Promise<void> {
    const baseTtl =
      value.status === "answered"
        ? this.options.positiveTtlSeconds
        : this.options.negativeTtlSeconds;
    const jitter = value.status === "answered" ? Math.floor(Math.random() * 60) : 0;
    await this.redis.set(key, JSON.stringify(value), "EX", baseTtl + jitter);
  }
}
