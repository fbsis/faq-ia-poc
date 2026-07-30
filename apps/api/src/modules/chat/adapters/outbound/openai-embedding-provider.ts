import OpenAI from "openai";
import type { EmbeddingProvider } from "../../application/ports.js";

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model = "text-embedding-3-small",
    private readonly timeoutMs = 5_000
  ) {
    this.client = new OpenAI({ apiKey, maxRetries: 1, timeout: timeoutMs });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create(
      { input: text, model: this.model, dimensions: 1536, encoding_format: "float" },
      { signal: AbortSignal.timeout(this.timeoutMs) }
    );
    const embedding = response.data[0]?.embedding;
    if (!embedding?.length) throw new Error("Embedding provider returned no vector.");
    return embedding;
  }
}
