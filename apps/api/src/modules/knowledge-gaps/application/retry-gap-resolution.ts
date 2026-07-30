import type { RetryGapResolutionInput } from "@faq/contracts";
import type { Clock, IdGenerator } from "../../../shared/domain/ports.js";
import type { KnowledgeGapRepository } from "./ports.js";

export class RetryGapResolution {
  constructor(
    private readonly repository: Pick<KnowledgeGapRepository, "retryResolution">,
    private readonly ids: IdGenerator,
    private readonly clock: Clock
  ) {}

  execute(request: {
    knowledgeGapId: string;
    adminId: string;
    idempotencyKey: string;
    input: RetryGapResolutionInput;
  }) {
    return this.repository.retryResolution({
      ...request,
      resolutionId: this.ids.next(),
      eventId: this.ids.next(),
      outboxId: this.ids.next(),
      createdAt: this.clock.now()
    });
  }
}
