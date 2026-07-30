import type { EmbeddingProvider } from "../../modules/chat/application/ports.js";
import type { FaqEmbeddingRepository } from "../../modules/faq/application/ports.js";
import type { PrepareFaqEmbeddingJob } from "./job-contracts.js";

export async function processFaqEmbedding(
  job: PrepareFaqEmbeddingJob,
  repository: FaqEmbeddingRepository,
  embeddings: Pick<EmbeddingProvider, "embed">
): Promise<void> {
  const content = await repository.getEmbeddingContent(job.faqId);
  if (!content || content.contentVersion !== job.contentVersion) return;
  try {
    const embedding = await embeddings.embed(content.text);
    await repository.activateEmbedding(job.faqId, job.contentVersion, embedding, job.resolutionId);
  } catch (error) {
    if (isTransient(error)) throw error;
    const message = error instanceof Error ? error.message : "Unknown embedding failure";
    await repository.failEmbedding(job.faqId, job.contentVersion, message, job.resolutionId);
  }
}

function isTransient(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "transient" in error) {
    return Boolean(error.transient);
  }
  if (typeof error === "object" && error !== null) {
    const status = "status" in error && typeof error.status === "number" ? error.status : 0;
    const name = "name" in error && typeof error.name === "string" ? error.name : "";
    const code = "code" in error && typeof error.code === "string" ? error.code : "";
    return (
      status === 408 ||
      status === 409 ||
      status === 429 ||
      status >= 500 ||
      name === "AbortError" ||
      ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED"].includes(code)
    );
  }
  return false;
}
