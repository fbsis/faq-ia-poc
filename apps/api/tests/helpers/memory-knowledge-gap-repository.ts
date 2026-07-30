import type {
  GapResolution,
  KnowledgeGap,
  KnowledgeGapDetails,
  KnowledgeGapListQuery,
  KnowledgeGapPage
} from "@faq/contracts";
import type {
  DismissKnowledgeGapCommand,
  KnowledgeGapRepository,
  ReopenKnowledgeGapCommand,
  RetryGapResolutionCommand,
  ResolveKnowledgeGapCommand
} from "../../src/modules/knowledge-gaps/application/ports.js";

export class MemoryKnowledgeGapRepository implements KnowledgeGapRepository {
  constructor(private gap?: KnowledgeGapDetails) {}

  list(query: KnowledgeGapListQuery): Promise<KnowledgeGapPage> {
    const items = this.gap && (!query.status || query.status === this.gap.status) ? [this.gap] : [];
    return Promise.resolve({
      items,
      page: query.page,
      pageSize: query.pageSize,
      total: items.length
    });
  }

  get(id: string): Promise<KnowledgeGapDetails | null> {
    return Promise.resolve(this.gap?.id === id ? this.gap : null);
  }

  resolve(command: ResolveKnowledgeGapCommand): Promise<GapResolution> {
    if (!this.gap || this.gap.id !== command.knowledgeGapId) {
      return Promise.reject(new Error("Knowledge gap not found."));
    }
    const resolution: GapResolution = {
      id: command.resolutionId,
      knowledgeGapId: command.knowledgeGapId,
      mode: command.input.mode,
      faqId: command.faqId,
      faqStatus: "embedding_pending",
      status: "pending",
      createdAt: command.createdAt.toISOString()
    };
    this.gap = {
      ...this.gap,
      status: "resolving",
      resolvedFaqId: command.faqId,
      version: this.gap.version + 1,
      currentResolution: resolution
    };
    return Promise.resolve(resolution);
  }

  retryResolution(command: RetryGapResolutionCommand): Promise<GapResolution> {
    if (
      !this.gap ||
      this.gap.id !== command.knowledgeGapId ||
      this.gap.version !== command.input.expectedVersion ||
      this.gap.currentResolution?.status !== "failed"
    ) {
      return Promise.reject(new Error("Knowledge gap is not eligible for retry."));
    }
    const resolution: GapResolution = {
      id: command.resolutionId,
      knowledgeGapId: command.knowledgeGapId,
      mode: this.gap.currentResolution.mode,
      faqId: this.gap.currentResolution.faqId,
      faqStatus: "embedding_pending",
      status: "pending",
      createdAt: command.createdAt.toISOString()
    };
    this.gap = {
      ...this.gap,
      status: "resolving",
      resolvedFaqId: resolution.faqId,
      version: this.gap.version + 1,
      currentResolution: resolution
    };
    return Promise.resolve(resolution);
  }

  dismiss(command: DismissKnowledgeGapCommand): Promise<KnowledgeGap> {
    return this.applyAction(command, "dismissed");
  }

  reopen(command: ReopenKnowledgeGapCommand): Promise<KnowledgeGap> {
    return this.applyAction(command, "open");
  }

  private applyAction(
    command: DismissKnowledgeGapCommand | ReopenKnowledgeGapCommand,
    status: "dismissed" | "open"
  ): Promise<KnowledgeGap> {
    if (
      !this.gap ||
      this.gap.id !== command.knowledgeGapId ||
      this.gap.version !== command.input.expectedVersion
    ) {
      return Promise.reject(new Error("Knowledge gap changed."));
    }
    this.gap = {
      ...this.gap,
      status,
      version: this.gap.version + 1
    };
    return Promise.resolve({
      id: this.gap.id,
      representativeQuestion: this.gap.representativeQuestion,
      status: this.gap.status,
      occurrenceCount: this.gap.occurrenceCount,
      firstOccurredAt: this.gap.firstOccurredAt,
      lastOccurredAt: this.gap.lastOccurredAt,
      ...(this.gap.suggestedCategory ? { suggestedCategory: this.gap.suggestedCategory } : {}),
      ...(this.gap.resolvedFaqId ? { resolvedFaqId: this.gap.resolvedFaqId } : {}),
      version: this.gap.version,
      createdAt: this.gap.createdAt,
      updatedAt: this.gap.updatedAt
    });
  }
}
