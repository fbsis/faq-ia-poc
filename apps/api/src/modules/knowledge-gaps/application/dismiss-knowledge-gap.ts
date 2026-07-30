import type { DismissKnowledgeGapInput } from "@faq/contracts";
import type { Clock, IdGenerator } from "../../../shared/domain/ports.js";
import type { KnowledgeGapRepository } from "./ports.js";

export class DismissKnowledgeGap {
  constructor(
    private readonly repository: Pick<KnowledgeGapRepository, "dismiss">,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  execute(request: {
    knowledgeGapId: string;
    adminId: string;
    idempotencyKey: string;
    input: DismissKnowledgeGapInput;
  }) {
    return this.repository.dismiss({
      ...request,
      eventId: this.ids.next(),
      createdAt: this.clock.now()
    });
  }
}
