import { errorEnvelopeSchema, type ErrorEnvelope } from "@faq/contracts";
import type { z } from "zod";

let csrfToken: string | undefined;

export class HttpError extends Error {
  constructor(readonly envelope: ErrorEnvelope) {
    super(envelope.message);
  }
}

export function rememberCsrfToken(value: string | null): void {
  if (value) csrfToken = value;
}

export async function requestJson<T>(
  path: string,
  options: RequestInit & { schema: z.ZodType<T> }
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("content-type", "application/json");
  if (csrfToken && options.method && options.method !== "GET") {
    headers.set("x-csrf-token", csrfToken);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include"
  });
  rememberCsrfToken(response.headers.get("x-csrf-token"));
  if (!response.ok) {
    const parsed = errorEnvelopeSchema.safeParse(await response.json().catch(() => undefined));
    throw new HttpError(
      parsed.success
        ? parsed.data
        : {
            code: "NETWORK_ERROR",
            message: "Não foi possível concluir a solicitação.",
            requestId: "browser"
          }
    );
  }
  return options.schema.parse(await response.json());
}

export async function requestEmpty(path: string, options: RequestInit = {}): Promise<void> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("content-type", "application/json");
  if (csrfToken && options.method && options.method !== "GET") {
    headers.set("x-csrf-token", csrfToken);
  }
  const response = await fetch(path, { ...options, headers, credentials: "include" });
  rememberCsrfToken(response.headers.get("x-csrf-token"));
  if (!response.ok) {
    const parsed = errorEnvelopeSchema.safeParse(await response.json().catch(() => undefined));
    throw new HttpError(
      parsed.success
        ? parsed.data
        : {
            code: "NETWORK_ERROR",
            message: "Não foi possível concluir a solicitação.",
            requestId: "browser"
          }
    );
  }
}
