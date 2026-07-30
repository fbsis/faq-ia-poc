import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeQuestion } from "../../apps/api/src/modules/chat/domain/normalize-question.js";

interface Corpus {
  faqs: Array<{ id: string; question: string; aliases: string[] }>;
  cases: Array<{ query: string; expectedFaqId: string }>;
}

const corpus = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/portuguese-faqs.json", import.meta.url)), "utf8")
) as Corpus;

describe("Portuguese retrieval quality gate", () => {
  it("returns the expected FAQ first for at least 90% of the labeled corpus", () => {
    const results = corpus.cases.map((testCase) => ({
      ...testCase,
      actualFaqId: rank(testCase.query)[0]?.id
    }));
    const correct = results.filter((result) => result.actualFaqId === result.expectedFaqId);
    const accuracy = correct.length / results.length;

    expect(
      accuracy,
      JSON.stringify(
        results.filter((result) => result.actualFaqId !== result.expectedFaqId),
        null,
        2
      )
    ).toBeGreaterThanOrEqual(0.9);
  });
});

function rank(query: string) {
  return corpus.faqs
    .map((faq) => ({
      id: faq.id,
      score: Math.max(...[faq.question, ...faq.aliases].map((source) => similarity(query, source)))
    }))
    .sort((left, right) => right.score - left.score);
}

function similarity(left: string, right: string): number {
  const leftTerms = terms(left);
  const rightTerms = terms(right);
  const intersection = [...leftTerms].filter((term) => rightTerms.has(term)).length;
  const tokenScore = (2 * intersection) / (leftTerms.size + rightTerms.size);
  const leftTrigrams = trigrams(normalizeQuestion(left));
  const rightTrigrams = trigrams(normalizeQuestion(right));
  const trigramIntersection = [...leftTrigrams].filter((term) => rightTrigrams.has(term)).length;
  const trigramScore = (2 * trigramIntersection) / (leftTrigrams.size + rightTrigrams.size);
  return tokenScore * 0.7 + trigramScore * 0.3;
}

function terms(value: string): Set<string> {
  const stopWords = new Set([
    "a",
    "as",
    "como",
    "da",
    "de",
    "do",
    "e",
    "meu",
    "meus",
    "minha",
    "o",
    "os",
    "para"
  ]);
  return new Set(
    normalizeQuestion(value)
      .split(" ")
      .filter((term) => term.length > 1 && !stopWords.has(term))
  );
}

function trigrams(value: string): Set<string> {
  const compact = `  ${value} `;
  return new Set(
    Array.from({ length: Math.max(0, compact.length - 2) }, (_, index) =>
      compact.slice(index, index + 3)
    )
  );
}
