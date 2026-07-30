import type {
  DismissKnowledgeGapInput,
  GapResolution,
  KnowledgeGap,
  KnowledgeGapDetails,
  KnowledgeGapListQuery,
  KnowledgeGapPage,
  ReopenKnowledgeGapInput,
  RetryGapResolutionInput,
  ResolveKnowledgeGapInput
} from "@faq/contracts";
import type { Interaction } from "../../chat/domain/interaction.js";

export interface UnansweredInteractionRecorder {
  record(interaction: Interaction): Promise<void>;
}

export interface KnowledgeGapRepository {
  list(query: KnowledgeGapListQuery): Promise<KnowledgeGapPage>;
  get(id: string): Promise<KnowledgeGapDetails | null>;
  resolve(command: ResolveKnowledgeGapCommand): Promise<GapResolution>;
  retryResolution(command: RetryGapResolutionCommand): Promise<GapResolution>;
  dismiss(command: DismissKnowledgeGapCommand): Promise<KnowledgeGap>;
  reopen(command: ReopenKnowledgeGapCommand): Promise<KnowledgeGap>;
}

export interface ResolveKnowledgeGapCommand {
  knowledgeGapId: string;
  adminId: string;
  resolutionId: string;
  faqId: string;
  eventId: string;
  outboxId: string;
  idempotencyKey: string;
  input: ResolveKnowledgeGapInput;
  createdAt: Date;
}

interface KnowledgeGapActionCommand<TInput> {
  knowledgeGapId: string;
  adminId: string;
  eventId: string;
  idempotencyKey: string;
  input: TInput;
  createdAt: Date;
}

export type DismissKnowledgeGapCommand = KnowledgeGapActionCommand<DismissKnowledgeGapInput>;
export type ReopenKnowledgeGapCommand = KnowledgeGapActionCommand<ReopenKnowledgeGapInput>;

export interface RetryGapResolutionCommand {
  knowledgeGapId: string;
  adminId: string;
  resolutionId: string;
  eventId: string;
  outboxId: string;
  idempotencyKey: string;
  input: RetryGapResolutionInput;
  createdAt: Date;
}
