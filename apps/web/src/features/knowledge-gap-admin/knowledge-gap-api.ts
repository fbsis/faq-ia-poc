import {
  type DismissKnowledgeGapInput,
  gapResolutionSchema,
  knowledgeGapSchema,
  knowledgeGapDetailsSchema,
  knowledgeGapPageSchema,
  type GapResolution,
  type KnowledgeGap,
  type KnowledgeGapDetails,
  type KnowledgeGapListQuery,
  type KnowledgeGapPage,
  type ReopenKnowledgeGapInput,
  type ResolveKnowledgeGapInput
} from "@faq/contracts";
import { requestJson } from "../../shared/api/http-client.js";

export function listKnowledgeGaps(
  query: Partial<KnowledgeGapListQuery> = {}
): Promise<KnowledgeGapPage> {
  const parameters = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
    sort: query.sort ?? "occurrences_desc"
  });
  if (query.status) parameters.set("status", query.status);
  if (query.from) parameters.set("from", query.from);
  if (query.to) parameters.set("to", query.to);
  if (query.categoryId) parameters.set("categoryId", query.categoryId);
  return requestJson(`/api/v1/knowledge-gaps?${parameters}`, {
    method: "GET",
    schema: knowledgeGapPageSchema
  });
}

export function getKnowledgeGap(id: string): Promise<KnowledgeGapDetails> {
  return requestJson(`/api/v1/knowledge-gaps/${id}`, {
    method: "GET",
    schema: knowledgeGapDetailsSchema
  });
}

export function resolveKnowledgeGap(
  id: string,
  input: ResolveKnowledgeGapInput,
  idempotencyKey: string
): Promise<GapResolution> {
  return requestJson(`/api/v1/knowledge-gaps/${id}/resolutions`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(input),
    schema: gapResolutionSchema
  });
}

export function dismissKnowledgeGap(
  id: string,
  input: DismissKnowledgeGapInput,
  idempotencyKey: string
): Promise<KnowledgeGap> {
  return requestJson(`/api/v1/knowledge-gaps/${id}/dismiss`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(input),
    schema: knowledgeGapSchema
  });
}

export function reopenKnowledgeGap(
  id: string,
  input: ReopenKnowledgeGapInput,
  idempotencyKey: string
): Promise<KnowledgeGap> {
  return requestJson(`/api/v1/knowledge-gaps/${id}/reopen`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(input),
    schema: knowledgeGapSchema
  });
}
