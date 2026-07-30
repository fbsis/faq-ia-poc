import { createHash } from "node:crypto";
import type { EmbeddingProvider } from "../../application/ports.js";
import { normalizeQuestion } from "../../domain/normalize-question.js";

const DIMENSIONS = 1536;

export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  embed(text: string): Promise<number[]> {
    const vector = Array<number>(DIMENSIONS).fill(0);
    for (const token of normalizeQuestion(text).split(" ")) {
      if (!token) continue;
      const digest = createHash("sha256").update(token).digest();
      const index = digest.readUInt16BE(0) % DIMENSIONS;
      vector[index] = (vector[index] ?? 0) + (digest[2]! % 2 === 0 ? 1 : -1);
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return Promise.resolve(vector.map((value) => value / magnitude));
  }
}
