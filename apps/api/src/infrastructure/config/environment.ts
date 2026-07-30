import { z } from "zod";

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url().default("postgres://faq:faq@localhost:5432/faq"),
    CACHE_REDIS_URL: z.string().url().default("redis://localhost:6379"),
    QUEUE_REDIS_URL: z.string().url().default("redis://localhost:6380"),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
    EMBEDDING_PROVIDER: z.enum(["openai", "deterministic"]).default("deterministic"),
    SESSION_SECRET: z.string().min(32).default("local-session-secret-change-me-1234567890"),
    SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28_800),
    ADMIN_EMAIL: z.string().email().default("admin@example.com"),
    ADMIN_PASSWORD: z.string().min(8).max(200).default("change-this-password"),
    ORGANIZATION_TIME_ZONE: z.string().default("America/Sao_Paulo"),
    FAQ_ACCEPTANCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.78),
    FAQ_AMBIGUITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.7)
  })
  .superRefine((value, context) => {
    if (value.EMBEDDING_PROVIDER === "openai" && !value.OPENAI_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OPENAI_API_KEY"],
        message: "OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai."
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
