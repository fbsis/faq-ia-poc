# Tasks: FAQ Chatbot and Analytics Dashboard

**Input**: Design documents from `specs/001-faq-chatbot-analytics/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/openapi.yaml`, `contracts/queue-jobs.md`, `quickstart.md`, and the project constitution

**Tests**: Tests are mandatory for this feature. Write each listed test before its implementation,
confirm that it fails for the expected reason, and then make it pass.

**Organization**: Tasks are grouped by user story so each story can be implemented, demonstrated,
and tested as an independent increment after the shared foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel after its phase prerequisites because it changes different files
- **[Story]**: Maps the task to a user story from `spec.md`
- Every task names the exact repository-relative file or directory it changes

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the pnpm monorepo, applications, shared packages, containers, and quality
tooling.

- [X] T001 Create the pnpm workspace and root scripts in `package.json` and `pnpm-workspace.yaml`
- [X] T002 Create workspace manifests with pinned runtime dependencies in `apps/api/package.json`, `apps/web/package.json`, `packages/contracts/package.json`, `packages/ui/package.json`, and `packages/config/package.json`
- [X] T003 [P] Configure strict shared TypeScript and ESM settings in `tsconfig.json` and `packages/config/tsconfig/*.json`
- [X] T004 [P] Configure ESLint, Prettier, and import-boundary rules in `eslint.config.js`, `prettier.config.js`, and `.prettierignore`
- [X] T005 [P] Configure Vitest projects and constitution coverage thresholds in `vitest.workspace.ts`, `apps/api/vitest.config.ts`, and `apps/web/vitest.config.ts`
- [X] T006 [P] Create the API entry-point and process command skeletons in `apps/api/src/app.ts`, `apps/api/src/commands/start-api.ts`, `apps/api/src/commands/start-worker.ts`, and `apps/api/src/commands/relay-outbox.ts`
- [X] T007 [P] Create the React/Vite application shell in `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/src/main.tsx`, and `apps/web/src/app/router.tsx`
- [X] T008 [P] Create shared contract and configuration package entry-points in `packages/contracts/src/index.ts` and `packages/config/src/index.ts`
- [X] T009 [P] Configure Tailwind and the shadcn/ui workspace in `apps/web/tailwind.config.ts`, `apps/web/components.json`, `packages/ui/components.json`, and `packages/ui/src/index.ts`
- [X] T010 [P] Document environment variables and exclude local secrets and artifacts in `.env.example`, `.gitignore`, and `.dockerignore`
- [X] T011 Create the development topology with PostgreSQL/pgvector, cache Redis, queue Redis, API, web, relay, and worker in `compose.yaml`
- [X] T012 [P] Create multi-stage non-root application images and the static web server configuration in `docker/api.Dockerfile`, `docker/web.Dockerfile`, and `docker/web-server.conf`
- [X] T013 Create the optimized production topology, health checks, persistence, and restricted ingress settings in `compose.production.yaml`
- [X] T014 [P] Add pull-request quality and image-build gates in `.github/workflows/ci.yml`

**Checkpoint**: Workspaces install from one lockfile, development services are declared, and all root
quality commands resolve.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish contracts, persistence, shared infrastructure, authentication, and test
fixtures required by every user story.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

### Foundation Tests

- [X] T015 [P] Add deterministic clock, ID, password, embedding, cache, and repository fakes in `apps/api/tests/helpers/fakes.ts`
- [X] T016 [P] Add PostgreSQL/pgvector and isolated Redis Testcontainers fixtures in `apps/api/tests/helpers/test-environment.ts`
- [X] T017 [P] Add shared error-envelope and pagination contract tests in `packages/contracts/src/common.test.ts`
- [X] T018 [P] Add admin authentication and session use-case unit tests in `apps/api/tests/unit/auth/auth-use-cases.test.ts`
- [X] T019 [P] Add authentication repository and session-expiry integration tests in `apps/api/tests/integration/auth/postgres-auth.test.ts`
- [X] T020 [P] Add login, session, logout, CSRF, and throttling HTTP contract tests in `apps/api/tests/contract/auth.routes.test.ts`
- [X] T021 [P] Add protected-route and login-form behavior tests in `apps/web/tests/integration/auth/auth-flow.test.tsx`

### Foundation Implementation

- [X] T022 Define common error, pagination, identifier, and date-range Zod schemas in `packages/contracts/src/common.ts`
- [X] T023 [P] Implement typed environment loading and secret validation in `apps/api/src/infrastructure/config/environment.ts`
- [X] T024 [P] Implement request IDs, structured logging, error mapping, and safe redaction in `apps/api/src/infrastructure/http/observability.ts` and `apps/api/src/infrastructure/http/errors.ts`
- [X] T025 [P] Define shared domain clock, ID, hashing, and transaction ports in `apps/api/src/shared/domain/ports.ts`
- [X] T026 Enable pgvector and create all versioned tables, constraints, indexes, and rollback notes in `apps/api/src/infrastructure/database/migrations/0001_initial_schema.sql`
- [X] T027 Map Category, FAQ, Alias, Interaction, KnowledgeGap, Resolution, Event, Outbox, Admin, Session, and KnowledgeBaseState tables in `apps/api/src/infrastructure/database/schema.ts`
- [X] T028 Implement PostgreSQL connection, transaction, and migration runners in `apps/api/src/infrastructure/database/client.ts` and `apps/api/src/infrastructure/database/migrate.ts`
- [X] T029 [P] Configure separate fail-fast cache and durable queue Redis connections in `apps/api/src/infrastructure/redis/connections.ts`
- [X] T030 [P] Define queue names, identifier-only payload schemas, retry policy, retention, concurrency, and limiter settings in `apps/api/src/infrastructure/queue/config.ts`
- [X] T031 Define Admin and AdminSession domain rules and ports in `apps/api/src/modules/auth/domain/admin.ts` and `apps/api/src/modules/auth/application/ports.ts`
- [X] T032 [P] Implement secure password hashing and verification in `apps/api/src/modules/auth/adapters/outbound/password-hasher.ts`
- [X] T033 Implement PostgreSQL admin and server-session repositories in `apps/api/src/modules/auth/adapters/outbound/postgres-auth-repository.ts`
- [X] T034 Implement login, get-session, and logout use cases in `apps/api/src/modules/auth/application/login.ts`, `apps/api/src/modules/auth/application/get-session.ts`, and `apps/api/src/modules/auth/application/logout.ts`
- [X] T035 Implement secure cookies, CSRF enforcement, administrator authorization, and login throttling in `apps/api/src/modules/auth/adapters/inbound/http/auth-plugin.ts`
- [X] T036 Expose the authentication contract routes in `apps/api/src/modules/auth/adapters/inbound/http/auth-routes.ts`
- [X] T037 [P] Implement browser credential, CSRF, and typed error handling in `apps/web/src/shared/api/http-client.ts`
- [X] T038 Implement authentication state, protected routing, and login UI in `apps/web/src/features/auth/use-session.ts`, `apps/web/src/features/auth/protected-route.tsx`, and `apps/web/src/features/auth/login-page.tsx`
- [X] T039 Compose database, Redis, authentication, health, and graceful shutdown infrastructure in `apps/api/src/bootstrap/build-application.ts`

**Checkpoint**: Migrations run on pgvector, administrators can authenticate through protected
sessions, and the shared test environment is green.

---

## Phase 3: User Story 1 - Consult a Frequent Question (Priority: P1) 🎯 MVP

**Goal**: Let a public user submit an exact or semantically similar question, receive only an
approved FAQ answer, and persist an immutable interaction snapshot.

**Independent Test**: Seed one active embedded FAQ, ask its exact question and a Portuguese
paraphrase, and verify both return the approved answer within the target time with two immutable
interaction records.

### Tests for User Story 1

- [X] T040 [P] [US1] Add ask-question request and response schema tests in `packages/contracts/src/chat.test.ts`
- [X] T041 [P] [US1] Add normalization, cache-key, exact-match, and threshold-boundary unit tests in `apps/api/tests/unit/chat/retrieval-policy.test.ts`
- [X] T042 [P] [US1] Add answered, ambiguous, cache-hit, cache-miss, and cache-fail-open use-case tests in `apps/api/tests/unit/chat/ask-question.test.ts`
- [X] T043 [P] [US1] Add pgvector cosine ordering, active-status, category, exact, and full-text fallback tests in `apps/api/tests/integration/chat/postgres-faq-search.test.ts`
- [X] T044 [P] [US1] Add positive TTL, knowledge-version invalidation, and Redis-outage cache tests in `apps/api/tests/integration/chat/redis-answer-cache.test.ts`
- [X] T045 [P] [US1] Add `POST /api/v1/chat/questions` validation and response contract tests in `apps/api/tests/contract/chat.routes.test.ts`
- [X] T046 [P] [US1] Add chat input, pending, answered, retry, and accessibility behavior tests in `apps/web/tests/integration/chat/chat-page.test.tsx`

### Implementation for User Story 1

- [X] T047 [P] [US1] Define ask-question Zod contracts and exported TypeScript types in `packages/contracts/src/chat.ts`
- [X] T048 [P] [US1] Define immutable Interaction and FAQ candidate domain types in `apps/api/src/modules/chat/domain/interaction.ts` and `apps/api/src/modules/chat/domain/faq-candidate.ts`
- [X] T049 [P] [US1] Declare FAQ search, embedding, answer-cache, interaction, and knowledge-version ports in `apps/api/src/modules/chat/application/ports.ts`
- [X] T050 [P] [US1] Implement deterministic Portuguese-safe normalization and hashed versioned cache keys in `apps/api/src/modules/chat/domain/normalize-question.ts` and `apps/api/src/modules/chat/domain/answer-cache-key.ts`
- [X] T051 [P] [US1] Implement exact, accepted, ambiguous, and unanswered ranking decisions in `apps/api/src/modules/chat/domain/retrieval-policy.ts`
- [X] T052 [P] [US1] Implement the OpenAI embedding adapter with bounded timeout and safe retry in `apps/api/src/modules/chat/adapters/outbound/openai-embedding-provider.ts`
- [X] T053 [P] [US1] Implement active FAQ exact, HNSW cosine, and full-text retrieval in `apps/api/src/modules/chat/adapters/outbound/postgres-faq-search.ts`
- [X] T054 [P] [US1] Implement immutable interaction persistence in `apps/api/src/modules/chat/adapters/outbound/postgres-interaction-repository.ts`
- [X] T055 [P] [US1] Implement fail-open positive and short negative cache access in `apps/api/src/modules/chat/adapters/outbound/redis-answer-cache.ts`
- [X] T056 [US1] Implement answered and ambiguous retrieval orchestration in `apps/api/src/modules/chat/application/ask-question.ts`
- [X] T057 [US1] Expose validation, errors, and `POST /api/v1/chat/questions` in `apps/api/src/modules/chat/adapters/inbound/http/chat-routes.ts`
- [X] T058 [P] [US1] Implement the typed public chat API adapter in `apps/web/src/features/chat/chat-api.ts`
- [X] T059 [US1] Implement mutation lifecycle and retry behavior in `apps/web/src/features/chat/use-ask-question.ts`
- [X] T060 [P] [US1] Build accessible chat composer and message components with shadcn/ui in `apps/web/src/features/chat/chat-composer.tsx` and `apps/web/src/features/chat/chat-message.tsx`
- [X] T061 [US1] Assemble the public chat page and route in `apps/web/src/features/chat/chat-page.tsx` and `apps/web/src/app/router.tsx`
- [X] T062 [US1] Add deterministic category, FAQ, embedding, and answered-interaction seed data in `apps/api/src/infrastructure/database/seed.ts`

**Checkpoint**: The answered-chat MVP works without the administration or analytics stories and
never generates answer text.

---

## Phase 4: User Story 2 - Handle an Unanswered Question (Priority: P2)

**Goal**: Return a safe fallback for unknown or unreliable questions, preserve retryable input on
failure, and create a durable grouped knowledge gap without changing individual interactions.

**Independent Test**: Ask an unrelated question twice, verify both responses contain the fallback,
two unanswered interactions exist, and one open gap links both occurrences.

### Tests for User Story 2

- [ ] T063 [P] [US2] Add knowledge-gap grouping, recurrence, and immutable-history domain tests in `apps/api/tests/unit/knowledge-gaps/group-unanswered.test.ts`
- [ ] T064 [P] [US2] Add low-confidence, provider-failure, database-failure, and safe-fallback use-case tests in `apps/api/tests/unit/chat/unanswered-question.test.ts`
- [ ] T065 [P] [US2] Add atomic interaction insertion and knowledge-gap upsert integration tests in `apps/api/tests/integration/knowledge-gaps/postgres-grouping.test.ts`
- [ ] T066 [P] [US2] Add deterministic fallback behavior under OpenAI and cache outages in `apps/api/tests/integration/chat/retrieval-failures.test.ts`
- [ ] T067 [P] [US2] Extend chat HTTP contract tests for unanswered, ambiguous, invalid, and unavailable responses in `apps/api/tests/contract/chat.routes.test.ts`
- [ ] T068 [P] [US2] Add fallback guidance, input preservation, and retry UI tests in `apps/web/tests/integration/chat/unanswered-chat.test.tsx`

### Implementation for User Story 2

- [ ] T069 [P] [US2] Define KnowledgeGap grouping and recurrence domain rules in `apps/api/src/modules/knowledge-gaps/domain/knowledge-gap.ts`
- [ ] T070 [P] [US2] Declare atomic unanswered-interaction and gap-grouping ports in `apps/api/src/modules/knowledge-gaps/application/ports.ts`
- [ ] T071 [US2] Implement transactional gap upsert and interaction linking in `apps/api/src/modules/knowledge-gaps/adapters/outbound/postgres-unanswered-recorder.ts`
- [ ] T072 [US2] Extend question orchestration with safe unanswered, ambiguous, and failed outcomes in `apps/api/src/modules/chat/application/ask-question.ts`
- [ ] T073 [US2] Map stable recovery guidance and service errors in `apps/api/src/modules/chat/adapters/inbound/http/chat-routes.ts`
- [ ] T074 [P] [US2] Render unanswered guidance and approved suggestions in `apps/web/src/features/chat/unanswered-message.tsx`
- [ ] T075 [US2] Preserve the submitted question and expose safe retry state in `apps/web/src/features/chat/use-ask-question.ts`
- [ ] T076 [US2] Add the answered, ambiguous, unanswered, and recoverable-error Playwright journey in `tests/e2e/chat.spec.ts`

**Checkpoint**: Unknown questions are safe, auditable, grouped deterministically, and independently
visible in storage.

---

## Phase 5: User Story 3 - Analyze Usage and Trends (Priority: P3)

**Goal**: Give an authorized administrator consistent period-based totals, rankings, unanswered
metrics, category distribution, backlog state, and time series with clear loading, empty, and
error states.

**Independent Test**: Seed a known cross-date dataset, select a fixed interval, and verify every
widget matches the source interactions and configured organization time zone.

### Tests for User Story 3

- [ ] T077 [P] [US3] Add analytics summary and date-range contract tests in `packages/contracts/src/analytics.test.ts`
- [ ] T078 [P] [US3] Add range validation, granularity, and time-zone use-case tests in `apps/api/tests/unit/analytics/get-analytics-summary.test.ts`
- [ ] T079 [P] [US3] Add total, top-question, unanswered, and category projection tests in `apps/api/tests/integration/analytics/postgres-analytics.test.ts`
- [ ] T080 [P] [US3] Add uncategorized, empty-period, historical-unanswered, backlog, and time-zone consistency tests in `apps/api/tests/integration/analytics/analytics-edge-cases.test.ts`
- [ ] T081 [P] [US3] Add `GET /api/v1/analytics/summary` authorization and contract tests in `apps/api/tests/contract/analytics.routes.test.ts`
- [ ] T082 [P] [US3] Add filter synchronization and chart transformation hook tests in `apps/web/tests/unit/dashboard/dashboard-hooks.test.tsx`
- [ ] T083 [P] [US3] Add loading, empty, error, KPI, chart, and accessible-table tests in `apps/web/tests/integration/dashboard/dashboard-page.test.tsx`

### Implementation for User Story 3

- [ ] T084 [P] [US3] Define analytics request and summary Zod contracts in `packages/contracts/src/analytics.ts`
- [ ] T085 [P] [US3] Define analytics projection types and repository port in `apps/api/src/modules/analytics/application/ports.ts`
- [ ] T086 [US3] Implement one-snapshot PostgreSQL projections for totals, rankings, gaps, categories, and timeline in `apps/api/src/modules/analytics/adapters/outbound/postgres-analytics-repository.ts`
- [ ] T087 [US3] Implement validated range and organization-time-zone orchestration in `apps/api/src/modules/analytics/application/get-analytics-summary.ts`
- [ ] T088 [US3] Expose the authorized analytics summary endpoint in `apps/api/src/modules/analytics/adapters/inbound/http/analytics-routes.ts`
- [ ] T089 [P] [US3] Implement the typed analytics API and query hook in `apps/web/src/features/dashboard/analytics-api.ts` and `apps/web/src/features/dashboard/use-analytics.ts`
- [ ] T090 [P] [US3] Implement URL-backed period filters in `apps/web/src/features/dashboard/use-analytics-filters.ts` and `apps/web/src/features/dashboard/analytics-filters.tsx`
- [ ] T091 [P] [US3] Build KPI and backlog cards in `apps/web/src/features/dashboard/summary-cards.tsx`
- [ ] T092 [P] [US3] Build Recharts time-series, category, and frequency visualizations with accessible tables in `apps/web/src/features/dashboard/analytics-charts.tsx`
- [ ] T093 [US3] Assemble protected dashboard loading, empty, error, and success states in `apps/web/src/features/dashboard/dashboard-page.tsx` and `apps/web/src/app/router.tsx`
- [ ] T094 [US3] Add fixed-period totals, filters, empty state, and historical-versus-backlog Playwright coverage in `tests/e2e/dashboard.spec.ts`

**Checkpoint**: Analytics is reproducible from PostgreSQL interactions and remains distinct from
the current administrative backlog.

---

## Phase 6: User Story 4 - Maintain the Knowledge Base (Priority: P4)

**Goal**: Let administrators manage categories and FAQ lifecycle safely, with asynchronous
embedding preparation, versioned cache invalidation, and immutable historical interactions.

**Independent Test**: Create a category and FAQ, wait for activation, retrieve it in chat, edit it,
verify new chats use the new answer while old snapshots do not change, then deactivate it.

### Tests for User Story 4

- [ ] T095 [P] [US4] Add category and FAQ input, page, status, and retry contract tests in `packages/contracts/src/faqs.test.ts`
- [ ] T096 [P] [US4] Add FAQ validation, duplicate, content-version, and lifecycle transition tests in `apps/api/tests/unit/faq/faq.test.ts`
- [ ] T097 [P] [US4] Add category and FAQ create, edit, activation, deactivation, and retry use-case tests in `apps/api/tests/unit/faq/faq-use-cases.test.ts`
- [ ] T098 [P] [US4] Add PostgreSQL FAQ CRUD, alias, duplicate, and knowledge-version tests in `apps/api/tests/integration/faq/postgres-faq-repository.test.ts`
- [ ] T099 [P] [US4] Add FAQ mutation plus outbox atomicity and rollback tests in `apps/api/tests/integration/faq/faq-outbox.test.ts`
- [ ] T100 [P] [US4] Add outbox recovery, deterministic BullMQ ID, and duplicate-publication tests in `apps/api/tests/integration/queue/outbox-relay.test.ts`
- [ ] T101 [P] [US4] Add embedding worker success, stale-version, transient retry, permanent failure, and shutdown tests in `apps/api/tests/integration/queue/embedding-worker.test.ts`
- [ ] T102 [P] [US4] Add category and FAQ HTTP authorization, validation, pagination, and lifecycle contract tests in `apps/api/tests/contract/faq.routes.test.ts`
- [ ] T103 [P] [US4] Add FAQ list, form, validation, pending, failed, retry, and status UI tests in `apps/web/tests/integration/faq-admin/faq-admin.test.tsx`

### Implementation for User Story 4

- [ ] T104 [P] [US4] Define category, FAQ, pagination, status, and embedding-retry Zod contracts in `packages/contracts/src/faqs.ts`
- [ ] T105 [P] [US4] Define Category, FaqEntry, FaqAlias, and lifecycle rules in `apps/api/src/modules/faq/domain/category.ts` and `apps/api/src/modules/faq/domain/faq-entry.ts`
- [ ] T106 [P] [US4] Declare FAQ repository, knowledge-version, outbox, and queue publisher ports in `apps/api/src/modules/faq/application/ports.ts`
- [ ] T107 [P] [US4] Define identifier-only outbox and embedding job contracts in `apps/api/src/infrastructure/queue/job-contracts.ts`
- [ ] T108 [US4] Implement PostgreSQL category, FAQ, alias, knowledge-version, and outbox persistence in `apps/api/src/modules/faq/adapters/outbound/postgres-faq-repository.ts`
- [ ] T109 [P] [US4] Implement BullMQ publication with deterministic IDs and retention policy in `apps/api/src/modules/faq/adapters/outbound/bullmq-queue-publisher.ts`
- [ ] T110 [US4] Implement list/create categories and list/get/create/update/status/retry FAQ use cases in `apps/api/src/modules/faq/application/faq-use-cases.ts`
- [ ] T111 [US4] Implement the locking outbox relay and reconciliation loop in `apps/api/src/infrastructure/queue/outbox-relay.ts`
- [ ] T112 [US4] Implement content-version-guarded embedding processing and FAQ activation in `apps/api/src/infrastructure/queue/process-faq-embedding.ts`
- [ ] T113 [US4] Wire queue relay and worker lifecycle, limiter, retries, events, and graceful shutdown in `apps/api/src/commands/relay-outbox.ts` and `apps/api/src/commands/start-worker.ts`
- [ ] T114 [US4] Expose authorized category and FAQ lifecycle routes in `apps/api/src/modules/faq/adapters/inbound/http/faq-routes.ts`
- [ ] T115 [P] [US4] Implement typed FAQ and category APIs with TanStack Query invalidation in `apps/web/src/features/faq-admin/faq-api.ts` and `apps/web/src/features/faq-admin/use-faqs.ts`
- [ ] T116 [P] [US4] Build category management and reusable FAQ form validation in `apps/web/src/features/faq-admin/category-manager.tsx` and `apps/web/src/features/faq-admin/faq-form.tsx`
- [ ] T117 [US4] Build FAQ list, status, embedding progress, failure, and retry UI in `apps/web/src/features/faq-admin/faq-admin-page.tsx`
- [ ] T118 [US4] Add the full FAQ lifecycle and immutable-history Playwright journey in `tests/e2e/faq-admin.spec.ts`

**Checkpoint**: Administrators can safely evolve searchable knowledge through the durable
outbox/BullMQ pipeline.

---

## Phase 7: User Story 5 - Resolve Unanswered Questions (Priority: P4)

**Goal**: Give administrators a filtered unanswered inbox, detailed occurrence and audit history,
idempotent resolution into searchable knowledge, dismiss/reopen actions, and protected Bull Board
visibility.

**Independent Test**: Create repeated unanswered interactions, resolve one gap, observe its
identifier-only BullMQ job, verify it becomes resolved only after FAQ activation, and confirm
retry, concurrent requests, dismissal, and reopening preserve one auditable result.

### Tests for User Story 5

- [ ] T119 [P] [US5] Add knowledge-gap page, detail, resolution, event, dismiss, and reopen contract tests in `packages/contracts/src/knowledge-gaps.test.ts`
- [ ] T120 [P] [US5] Add open, resolving, resolved, failed, dismissed, reopened, and recurrence state tests in `apps/api/tests/unit/knowledge-gaps/knowledge-gap.test.ts`
- [ ] T121 [P] [US5] Add resolution idempotency, request-hash, optimistic-version, and duplicate-prevention tests in `apps/api/tests/unit/knowledge-gaps/resolve-knowledge-gap.test.ts`
- [ ] T122 [P] [US5] Add dismiss, reopen, and audit-event use-case tests in `apps/api/tests/unit/knowledge-gaps/gap-actions.test.ts`
- [ ] T123 [P] [US5] Add filtered inbox, derived counts, occurrence detail, and append-only audit integration tests in `apps/api/tests/integration/knowledge-gaps/postgres-gap-repository.test.ts`
- [ ] T124 [P] [US5] Add concurrent resolution, atomic outbox, retry-key, and rollback integration tests in `apps/api/tests/integration/knowledge-gaps/resolution-concurrency.test.ts`
- [ ] T125 [P] [US5] Add worker completion, exhausted failure, recurrence, and stale-result integration tests in `apps/api/tests/integration/knowledge-gaps/resolution-worker.test.ts`
- [ ] T126 [P] [US5] Add BullMQ attempts, backoff, rate limit, retention, stalled recovery, and duplicate-execution tests in `apps/api/tests/integration/queue/bullmq-policy.test.ts`
- [ ] T127 [P] [US5] Add Bull Board anonymous denial, admin access, read-only mode, and payload-redaction tests in `apps/api/tests/contract/bull-board.test.ts`
- [ ] T128 [P] [US5] Add knowledge-gap list, filters, details, resolution, conflict, failure, dismiss, and reopen UI tests in `apps/web/tests/integration/knowledge-gaps/knowledge-gap-admin.test.tsx`

### Implementation for User Story 5

- [ ] T129 [P] [US5] Define knowledge-gap list, detail, resolution, event, dismiss, and reopen Zod contracts in `packages/contracts/src/knowledge-gaps.ts`
- [ ] T130 [P] [US5] Define GapResolution and append-only KnowledgeGapEvent domain rules in `apps/api/src/modules/knowledge-gaps/domain/gap-resolution.ts` and `apps/api/src/modules/knowledge-gaps/domain/knowledge-gap-event.ts`
- [ ] T131 [P] [US5] Declare knowledge-gap query, command, audit, idempotency, and transaction ports in `apps/api/src/modules/knowledge-gaps/application/ports.ts`
- [ ] T132 [US5] Implement filtered gap queries, derived occurrences, audit history, and row-locking commands in `apps/api/src/modules/knowledge-gaps/adapters/outbound/postgres-knowledge-gap-repository.ts`
- [ ] T133 [P] [US5] Implement list and detail use cases in `apps/api/src/modules/knowledge-gaps/application/list-knowledge-gaps.ts` and `apps/api/src/modules/knowledge-gaps/application/get-knowledge-gap.ts`
- [ ] T134 [US5] Implement idempotent create-or-update resolution and transactional outbox creation in `apps/api/src/modules/knowledge-gaps/application/resolve-knowledge-gap.ts`
- [ ] T135 [P] [US5] Implement audited dismiss and reopen transitions in `apps/api/src/modules/knowledge-gaps/application/dismiss-knowledge-gap.ts` and `apps/api/src/modules/knowledge-gaps/application/reopen-knowledge-gap.ts`
- [ ] T136 [P] [US5] Implement audited embedding retry eligibility in `apps/api/src/modules/knowledge-gaps/application/retry-gap-resolution.ts`
- [ ] T137 [US5] Complete gap resolution or safely return it to open from the embedding worker in `apps/api/src/infrastructure/queue/process-faq-embedding.ts`
- [ ] T138 [US5] Expose authorized list, detail, resolve, dismiss, reopen, and retry endpoints in `apps/api/src/modules/knowledge-gaps/adapters/inbound/http/knowledge-gap-routes.ts`
- [ ] T139 [US5] Mount authenticated, redacted, production-read-only Bull Board at `/admin/queues` in `apps/api/src/infrastructure/queue/bull-board.ts`
- [ ] T140 [P] [US5] Implement typed gap APIs and query/mutation hooks in `apps/web/src/features/knowledge-gap-admin/knowledge-gap-api.ts` and `apps/web/src/features/knowledge-gap-admin/use-knowledge-gaps.ts`
- [ ] T141 [P] [US5] Build inbox filters, sort controls, status badges, and paginated list in `apps/web/src/features/knowledge-gap-admin/knowledge-gap-list.tsx`
- [ ] T142 [P] [US5] Build occurrence details and append-only audit timeline in `apps/web/src/features/knowledge-gap-admin/knowledge-gap-details.tsx` and `apps/web/src/features/knowledge-gap-admin/gap-audit-timeline.tsx`
- [ ] T143 [P] [US5] Build create/update resolution form with pending, failed, retry, and conflict states in `apps/web/src/features/knowledge-gap-admin/resolve-gap-form.tsx`
- [ ] T144 [US5] Assemble protected inbox/detail routes with dismiss and reopen controls in `apps/web/src/features/knowledge-gap-admin/knowledge-gap-admin-page.tsx` and `apps/web/src/app/router.tsx`
- [ ] T145 [US5] Add resolution, idempotency, concurrency, failure, dismiss, reopen, and Bull Board Playwright journeys in `tests/e2e/knowledge-gap-admin.spec.ts`

**Checkpoint**: The improvement loop from an unanswered interaction to active approved knowledge is
durable, idempotent, auditable, and operationally visible.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verify constitution gates, security, performance, delivery, and operating
documentation across all stories.

- [ ] T146 [P] Add correlation and non-sensitive metrics for HTTP, cache, retrieval, OpenAI, outbox, jobs, and gaps in `apps/api/src/infrastructure/observability/metrics.ts`
- [ ] T147 [P] Add log-redaction and correlation propagation regression tests in `apps/api/tests/integration/observability/observability.test.ts`
- [ ] T148 [P] Add security headers, payload limits, public chat rate limits, and production cookie policy in `apps/api/src/infrastructure/http/security.ts`
- [ ] T149 [P] Add unauthorized, CSRF, cookie, rate-limit, and sensitive-data security tests in `apps/api/tests/integration/security/security-controls.test.ts`
- [ ] T150 [P] Add keyboard, screen-reader, contrast, and responsive checks for critical pages in `apps/web/tests/integration/accessibility/critical-pages.test.tsx`
- [ ] T151 [P] Add the labeled Portuguese retrieval evaluation corpus and 90% top-result gate in `tests/retrieval/fixtures/portuguese-faqs.json` and `tests/retrieval/evaluate-retrieval.test.ts`
- [ ] T152 [P] Add 100-session chat and 12-month dashboard performance scenarios in `tests/performance/chat-and-dashboard.k6.js`
- [ ] T153 [P] Add production image, non-root, health, AOF, noeviction, SPA-cache, and dependency-pruning checks in `tests/containers/production-images.test.sh`
- [ ] T154 [P] Add local setup, architecture, commands, environment, migration, test, and troubleshooting documentation in `README.md`
- [ ] T155 [P] Document queue operations, failed-job recovery, Bull Board access, retention, and Redis restoration in `docs/operations/queue-runbook.md`
- [ ] T156 [P] Document privacy, OpenAI data flow, interaction retention, secret handling, and redaction in `docs/operations/privacy-and-security.md`
- [ ] T157 Add reproducible quickstart seed and validation commands in `apps/api/src/infrastructure/database/quickstart-seed.ts` and `package.json`
- [ ] T158 Run and record every format, lint, typecheck, unit, integration, build, Playwright, retrieval, performance, and container gate in `specs/001-faq-chatbot-analytics/checklists/implementation-validation.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: Starts immediately.
- **Phase 2 — Foundation**: Depends on Phase 1 and blocks every user story.
- **Phase 3 — US1**: Depends on Phase 2 and is the MVP.
- **Phase 4 — US2**: Depends on Phase 2; integrates with the chat orchestration introduced by US1.
- **Phase 5 — US3**: Depends on Phase 2 and seeded Interactions; it can proceed alongside US1/US2
  after the Interaction schema is stable.
- **Phase 6 — US4**: Depends on Phase 2; its administration UI and queue pipeline are independently
  testable with seeded data.
- **Phase 7 — US5**: Depends on US2 gap persistence and US4 FAQ/outbox/worker lifecycle.
- **Phase 8 — Polish**: Depends on all stories selected for release.

### User Story Dependency Graph

```text
Setup → Foundation → US1 (answered-chat MVP)
                   ├→ US2 (safe unanswered capture) ─┐
                   ├→ US3 (analytics)                ├→ US5 (gap resolution)
                   └→ US4 (FAQ lifecycle + worker) ──┘
All selected stories → Polish and release validation
```

### Within Each User Story

1. Write the listed tests and confirm they fail for the intended missing behavior.
2. Define contracts and domain rules.
3. Declare application ports and implement use cases.
4. Implement outbound adapters before inbound HTTP/UI integration where required.
5. Make contract, integration, UI, and end-to-end tests pass.
6. Validate the story's independent test before proceeding.

## Parallel Opportunities

- In Phase 1, tasks marked `[P]` can run after T001/T002 without editing the same files.
- In Phase 2, test fixtures and contract/auth tests can run in parallel; infrastructure adapters
  can run in parallel once their ports and schema are stable.
- US1, US3, and US4 can be assigned independently after the foundation; US2 coordinates only its
  final changes to the US1 chat orchestration.
- Within every story, contract, domain, adapter integration, and web tests marked `[P]` can be
  written simultaneously.
- US5 UI work can proceed against MSW contracts while backend resolution and BullMQ tests are
  implemented.

### Parallel Example: User Story 1

```text
Task T040: chat contract tests
Task T041: retrieval policy tests
Task T043: PostgreSQL search integration tests
Task T046: React chat behavior tests
```

### Parallel Example: User Story 2

```text
Task T063: knowledge-gap grouping tests
Task T064: safe fallback use-case tests
Task T066: provider and cache outage tests
Task T068: unanswered chat UI tests
```

### Parallel Example: User Story 3

```text
Task T077: analytics contract tests
Task T079: PostgreSQL projection tests
Task T082: dashboard hook tests
Task T083: dashboard component tests
```

### Parallel Example: User Story 4

```text
Task T095: FAQ contract tests
Task T096: FAQ lifecycle domain tests
Task T100: outbox relay tests
Task T103: FAQ administration UI tests
```

### Parallel Example: User Story 5

```text
Task T119: knowledge-gap contract tests
Task T121: resolution idempotency tests
Task T126: BullMQ policy tests
Task T128: knowledge-gap administration UI tests
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Seed an active FAQ and run the independent answered-chat test.
4. Stop and demonstrate the retrieval-only chatbot before expanding scope.

### Incremental Delivery

1. **MVP**: Foundation + US1 provides approved FAQ answers and immutable interaction records.
2. **Safety increment**: US2 adds safe fallback and durable unanswered capture.
3. **Insight increment**: US3 exposes consistent analytics and trends.
4. **Content increment**: US4 enables managed FAQ lifecycle and asynchronous embeddings.
5. **Improvement-loop increment**: US5 closes unanswered gaps with an audited workflow.
6. **Release increment**: Phase 8 proves security, performance, Docker, and documentation gates.

### Recommended Commit Boundaries

- Commit setup and foundation independently.
- Commit each passing user story as a reviewable vertical slice.
- Keep migrations, contracts, and their tests in the same logical commit as the behavior they
  enable.
- Do not mix generated shadcn/ui primitives with unrelated business changes.

## Notes

- `[P]` means different files and no dependency on an incomplete task at the same point.
- Every user-story task has a `[US#]` label; setup, foundation, and polish tasks intentionally do
  not.
- PostgreSQL is the business source of truth; Redis cache and BullMQ state are never authoritative.
- Queue payloads contain identifiers and versions only.
- Normal CI uses deterministic OpenAI test doubles and never calls the live API.
- Production Bull Board is authenticated, restricted, redacted, and read-only.
- Stop at any checkpoint to validate the story independently.
