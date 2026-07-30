import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(3000),
    HTTP_BODY_LIMIT_BYTES: z.coerce.number().int().min(1_024).default(32_768),
    CHAT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    DATABASE_URL: z.string().url().default("postgres://faq:faq@localhost:5432/faq"),
    CACHE_REDIS_URL: z.string().url().default("redis://localhost:6379"),
    QUEUE_REDIS_URL: z.string().url().default("redis://localhost:6380"),
    QUEUE_PREFIX: z.string().min(1).default("faq"),
    EMBEDDING_JOB_ATTEMPTS: z.coerce.number().int().positive().default(5),
    EMBEDDING_BACKOFF_MS: z.coerce.number().int().positive().default(2_000),
    EMBEDDING_BACKOFF_JITTER: z.coerce.number().min(0).max(1).default(0.2),
    EMBEDDING_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
    EMBEDDING_GLOBAL_CONCURRENCY: z.coerce.number().int().positive().default(10),
    EMBEDDING_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
    EMBEDDING_RATE_LIMIT_DURATION_MS: z.coerce.number().int().positive().default(60_000),
    BULL_BOARD_MUTATIONS_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    OPENAI_CHAT_MODEL: z.string().default("gpt-5.6-luna"),
    EMBEDDING_PROVIDER: z.enum(["openai", "deterministic"]).default("deterministic"),
    CONVERSATION_PROVIDER: z.enum(["openai", "deterministic"]).default("openai"),
    SESSION_SECRET: z.string().min(32).default("local-session-secret-change-me-1234567890"),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28_800),
    ADMIN_EMAIL: z.string().email().default("admin@example.com"),
    ADMIN_PASSWORD: z.string().min(8).max(200).default("change-this-password"),
    ORGANIZATION_TIME_ZONE: z.string().default("America/Sao_Paulo"),
    FAQ_ACCEPTANCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.78),
    FAQ_AMBIGUITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7)
  })
  .superRefine((value, context) => {
    if (
      (value.EMBEDDING_PROVIDER === "openai" || value.CONVERSATION_PROVIDER === "openai") &&
      !value.OPENAI_API_KEY
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required for the configured OpenAI providers."
      });
    }
    if (value.FAQ_AMBIGUITY_THRESHOLD >= value.FAQ_ACCEPTANCE_THRESHOLD) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["FAQ_AMBIGUITY_THRESHOLD"],
        message: "Ambiguity threshold must be lower than the acceptance threshold."
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  return environmentSchema.parse(source);
}
