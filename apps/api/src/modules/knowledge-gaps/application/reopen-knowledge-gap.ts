import type { ReopenKnowledgeGapInput } from "@faq/contracts";
import type { Clock, IdGenerator } from "../../../shared/domain/ports.js";
import type { KnowledgeGapRepository } from "./ports.js";

export class ReopenKnowledgeGap {
  constructor(
    private readonly repository: Pick<KnowledgeGapRepository, "reopen">,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  execute(request: {
    knowledgeGapId: string;
    adminId: string;
    idempotencyKey: string;
    input: ReopenKnowledgeGapInput;
  }) {
    return this.repository.reopen({
      ...request,
      eventId: this.ids.next(),
      createdAt: this.clock.now()
    });
  }
}
