export interface FaqCandidate {
  readonly id: string;
  readonly canonicalQuestion: string;
  readonly answer: string;
  readonly category: {
    readonly id: string;
    readonly name: string;
  };
  readonly confidence: number;
}
