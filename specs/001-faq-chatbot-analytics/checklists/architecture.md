# Architecture Requirements Quality Checklist: FAQ Chatbot and Analytics Dashboard

**Purpose**: Validate that architecture, consistency, recovery, and operational requirements are
complete, clear, consistent, measurable, and ready to guide implementation.
**Created**: 2026-07-30
**Feature**: [spec.md](../spec.md)

**Note**: This checklist evaluates the quality of the written requirements. It does not validate
the implementation.

**Review decision**: On 2026-07-30, the stakeholder accepted the current specification, plan,
contracts, data model, and System Design as sufficient for implementation. Configurable
operational values and organization-owned policies remain release inputs rather than architecture
blockers.

## Requirement Completeness

- [x] CHK001 Are source-of-truth boundaries documented for FAQs, interactions, knowledge gaps, audit events, analytics, cache entries, and queue state? [Completeness, Spec §FR-007–FR-009, FR-021–FR-030; Constitution §III]
- [x] CHK002 Are requirements defined for every knowledge change state, including draft, embedding pending, active, embedding failed, inactive, and reactivation? [Completeness, Spec §FR-011–FR-012, FR-025–FR-026; Gap]
- [x] CHK003 Are cache requirements complete for positive results, negative results, version invalidation, TTL expiry, bypass, and cache unavailability? [Completeness, Plan §Retrieval flow; Constitution §III]
- [x] CHK004 Are durable publication requirements documented for outbox creation, claiming, publication, reconciliation, and terminal publication failure? [Completeness, Plan §Unanswered-question triage flow; Gap]
- [x] CHK005 Are schema evolution, forward migration, rollback, and compatibility requirements defined for database and API contract changes? [Completeness, Constitution §Project-Wide Technical Standards; Gap]
- [x] CHK006 Are ownership and authorization requirements documented for application administration, Bull Board access, queue recovery, FAQ approval, and production incident response? [Completeness, Spec §FR-010, FR-032; Gap]

## Requirement Clarity

- [x] CHK007 Is “correspondência confiável” quantified or tied to a named, versioned retrieval policy and calibration process? [Ambiguity, Spec §FR-004–FR-005, SC-002]
- [x] CHK008 Is deterministic unanswered-question grouping specified precisely enough to distinguish normalization rules, grouping identity, and intentionally separate variants? [Clarity, Spec §FR-021, Assumptions]
- [x] CHK009 Are recoverable, permanent, interrupted, ambiguous, and unavailable outcomes defined without overlapping meanings? [Clarity, Spec §FR-008, FR-031; Ambiguity]
- [x] CHK010 Is “pronta para uso” defined as an atomic, observable state with all prerequisites for FAQ search explicitly listed? [Clarity, Spec §FR-025–FR-026]
- [x] CHK011 Is the organization time zone identified through an authoritative configuration source, including behavior when it is absent or invalid? [Clarity, Spec §Edge Cases, Assumptions; Gap]
- [x] CHK012 Are “condições normais”, “acessos normais”, and “conjunto representativo” defined with measurable workload and dataset boundaries? [Ambiguity, Spec §SC-001, SC-002, SC-008]

## Requirement Consistency

- [x] CHK013 Are the immutable-history requirements consistent across interaction recording, FAQ edits, and knowledge-gap resolution? [Consistency, Spec §FR-009, FR-030, SC-013]
- [x] CHK014 Are historical unanswered metrics clearly distinguished from the current open knowledge-gap backlog in every affected requirement? [Consistency, Spec §FR-015, FR-020–FR-021; Plan §Backlog and analytics semantics]
- [x] CHK015 Are fail-open cache requirements consistent with the requirement that every completed interaction is durably recorded? [Consistency, Spec §FR-007; Constitution §III]
- [x] CHK016 Are PostgreSQL source-of-truth requirements consistent with the stated use of Redis cache, BullMQ state, and Bull Board operational views? [Consistency, Constitution §III; Plan §Queue dashboard]
- [x] CHK017 Are external-AI data-minimization requirements consistent across question embedding, FAQ embedding, logs, queue payloads, and analytics dimensions? [Consistency, Constitution §III; Plan §Failure and privacy rules]

## Acceptance Criteria Quality

- [x] CHK018 Can answered-chat latency be measured from a defined start event to a defined user-visible completion event under a specified workload? [Measurability, Spec §SC-001, SC-009]
- [x] CHK019 Are retrieval-accuracy acceptance criteria accompanied by requirements for corpus composition, expected labels, sample size, and threshold-version recording? [Acceptance Criteria, Spec §SC-002; Gap]
- [x] CHK020 Is the one-minute analytics and knowledge-gap freshness window anchored to explicit persistence and visibility events? [Measurability, Spec §SC-004, SC-011]
- [x] CHK021 Are recovery requirements for unpublished outbox work and duplicate queue delivery expressed with objectively observable outcomes and time bounds? [Acceptance Criteria, Plan §Unanswered-question triage flow; Gap]
- [x] CHK022 Does the unauthorized-access criterion identify every protected surface, actor class, and expected denial boundary? [Acceptance Criteria, Spec §SC-010, FR-010, FR-032]

## Scenario Coverage

- [x] CHK023 Are primary requirements complete for exact match, semantic match, cache hit, cache miss, and persisted answer snapshot outcomes? [Coverage, Spec §US1, FR-003–FR-009]
- [x] CHK024 Are alternate requirements complete for close competing candidates, ambiguous outcomes, approved suggestions, and safe reformulation guidance? [Coverage, Spec §Edge Cases, FR-005–FR-006; Gap]
- [x] CHK025 Are exception requirements documented separately for cache failure, OpenAI timeout, OpenAI permanent failure, and PostgreSQL failure? [Coverage, Spec §FR-031; Plan §Failure and privacy rules]
- [x] CHK026 Are recovery requirements complete for queue Redis outage, unpublished outbox messages, stalled workers, exhausted retries, and graceful shutdown? [Coverage, Plan §BullMQ topology and policy; Gap]
- [x] CHK027 Are duplicate and replay requirements complete for repeated HTTP mutations, outbox publication, BullMQ delivery, and worker completion? [Coverage, Spec §FR-029, SC-014; Constitution §III]
- [x] CHK028 Are concurrent administrator requirements defined for stale versions, competing resolutions, idempotency-key reuse, dismissal, and reopening? [Coverage, Spec §Edge Cases, FR-027–FR-029]

## Edge Case Coverage

- [x] CHK029 Are the exact inclusive and exclusive behaviors at both similarity-threshold boundaries documented? [Edge Case, Plan §Retrieval flow; Ambiguity]
- [x] CHK030 Are requirements defined for FAQ category deactivation, category changes during embedding, and unavailable categories during gap resolution? [Edge Case, Spec §FR-011–FR-012, FR-024; Gap]
- [x] CHK031 Are stale-work requirements explicit when FAQ content changes while an older embedding request is in progress? [Edge Case, Spec §FR-029; Plan §Unanswered-question triage flow]
- [x] CHK032 Is recurrence behavior defined when a new unanswered interaction belongs to a previously resolved or dismissed gap? [Edge Case, Spec §FR-027–FR-030; Gap]
- [x] CHK033 Are retention and redaction requirements defined so privacy operations do not silently invalidate immutable-history and analytics-consistency guarantees? [Edge Case, Spec §FR-009, FR-020, Assumptions; Gap]

## Non-Functional Requirements

- [x] CHK034 Are accessibility requirements specified for keyboard operation, focus management, status announcements, charts, tables, and error recovery? [Non-Functional, Constitution §Project-Wide Technical Standards; Gap]
- [x] CHK035 Are capacity requirements defined for FAQ corpus size, interaction growth, knowledge-gap backlog, outbox accumulation, and queue depth? [Non-Functional, Spec §SC-009; Gap]
- [x] CHK036 Are recovery-point, recovery-time, backup, restoration, and disaster-recovery requirements documented for PostgreSQL and queue Redis? [Non-Functional, Gap]
- [x] CHK037 Are liveness and readiness meanings specified for the API, web application, database, cache, queue, relay, and worker? [Non-Functional, Constitution §V; Gap]
- [x] CHK038 Are observability requirements measurable for correlation, latency, errors, cache outcomes, retrieval quality, outbox age, queue health, and knowledge-gap state without exposing sensitive content? [Non-Functional, Constitution §V]

## Dependencies, Assumptions, and Conflicts

- [x] CHK039 Is the dependency on OpenAI embeddings documented with quota, timeout, regional availability, model-version, dimension, and cost assumptions? [Dependency, Plan §Embeddings; Gap]
- [x] CHK040 Are the organization-provided FAQ corpus, categories, fallback channel, time zone, retention policy, and administrator credentials treated as explicit launch dependencies with defined owners? [Assumption, Spec §Assumptions]
- [x] CHK041 Is the single-organization assumption consistently bounded so no requirement accidentally implies tenant-aware authorization, storage, analytics, or cache partitioning? [Consistency, Spec §Assumptions; Plan §Scale/Scope]
- [x] CHK042 Is the plan statement that the constitution was unratified reconciled with Constitution v1.0.0 and its mandatory project-wide gates? [Conflict, Plan §Constitution Check; Constitution §Governance]

## Notes

- Check items off as requirement issues are resolved: `[x]`.
- Add findings and links to the amended requirement beside each item.
- A checked item means the written requirement is sufficient, not that the implementation exists.
- All items were accepted by stakeholder decision on 2026-07-30.
