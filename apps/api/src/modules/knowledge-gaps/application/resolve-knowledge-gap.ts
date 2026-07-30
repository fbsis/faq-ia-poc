import type { ResolveKnowledgeGapInput } from "@faq/contracts";
import type { Clock, IdGenerator } from "../../../shared/domain/ports.js";
import type { KnowledgeGapRepository } from "./ports.js";

export class ResolveKnowledgeGap {
  constructor(
    private readonly repository: Pick<KnowledgeGapRepository, "resolve">,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  execute(request: {
    knowledgeGapId: string;
    adminId: string;
    idempotencyKey: string;
    input: ResolveKnowledgeGapInput;
  }) {
    return this.repository.resolve({
      ...request,
      resolutionId: this.ids.next(),
      faqId: request.input.faqId ?? this.ids.next(),
      eventId: this.ids.next(),
      outboxId: this.ids.next(),
      createdAt: this.clock.now()
    });
  }
}
