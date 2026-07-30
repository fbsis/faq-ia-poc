import type {
  AnswerCache,
  CachedAnswer,
  FaqSearch,
  InteractionRepository
} from "../../src/modules/chat/application/ports.js";
import type { FaqCandidate } from "../../src/modules/chat/domain/faq-candidate.js";
import type { Interaction } from "../../src/modules/chat/domain/interaction.js";
import type { UnansweredInteractionRecorder } from "../../src/modules/knowledge-gaps/application/ports.js";

const testFaq: FaqCandidate = {
  id: "00000000-0000-4000-8000-000000000002",
  canonicalQuestion: "Como redefino minha senha?",
  answer: "Na tela de login, selecione “Esqueci minha senha”.",
  category: {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Conta"
  },
  confidence: 1
};

export class MemoryFaqSearch implements FaqSearch {
  private normalizedQuestion = "";

  findExact(normalizedQuestion: string): Promise<FaqCandidate | null> {
    this.normalizedQuestion = normalizedQuestion;
    return Promise.resolve(normalizedQuestion === "como redefino minha senha" ? testFaq : null);
  }

  findSemantic(): Promise<FaqCandidate[]> {
    return Promise.resolve(
      this.normalizedQuestion === "nao consigo acessar minha conta"
        ? [{ ...testFaq, confidence: 0.74 }]
        : []
    );
  }

  findFullText(): Promise<FaqCandidate[]> {
    return Promise.resolve([]);
  }
}

export class MemoryAnswerCache implements AnswerCache {
  private readonly values = new Map<string, CachedAnswer>();

  get(key: string): Promise<CachedAnswer | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  set(key: string, value: CachedAnswer): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}

export class MemoryInteractionRepository implements InteractionRepository {
  readonly values: Interaction[] = [];

  save(interaction: Interaction): Promise<void> {
    this.values.push(interaction);
    return Promise.resolve();
  }
}

export class MemoryUnansweredRecorder implements UnansweredInteractionRecorder {
  readonly values: Interaction[] = [];

  constructor(private readonly fail = false) {}

  record(interaction: Interaction): Promise<void> {
    if (this.fail) return Promise.reject(new Error("database unavailable"));
    this.values.push(interaction);
    return Promise.resolve();
  }
}
