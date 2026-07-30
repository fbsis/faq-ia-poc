# Implementation Plan: FAQ Chatbot and Analytics Dashboard

**Branch**: `001-faq-chatbot-analytics` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-faq-chatbot-analytics/spec.md`

## Summary

Build a pnpm TypeScript monorepo with a React single-page application, a Node.js API, and a BullMQ worker from the same backend codebase. The API applies hexagonal and Clean Architecture around conversational FAQ orchestration, semantic retrieval, unanswered-question triage, interaction recording, authentication, and analytics. PostgreSQL with pgvector is the source of truth, OpenAI interprets bounded conversation context, produces query and FAQ embeddings, and writes natural answers grounded in approved FAQ content. Redis provides a fail-open retrieval cache, and a separately configured Redis instance persists BullMQ queue state. Bull Board provides an authenticated queue dashboard. The solution uses Docker Compose for local development and separate optimized multi-stage images for production.

The implementation favors KISS and SOLID through explicit ports, small use cases, dependency inversion, English identifiers, and few shared packages. The conversational model may rephrase an approved answer for clarity, but it cannot answer from model knowledge: low-confidence searches return a safe fallback and provider failures fall back to the exact approved text.

## Technical Context

**Language/Version**: Node.js 24 LTS; TypeScript in strict mode; English source code and developer documentation; Portuguese user-facing copy

**Primary Dependencies**: pnpm 10 workspaces; Fastify; Drizzle ORM with `pg`; OpenAI Node SDK; BullMQ 5 with ioredis; `@bull-board/api` and `@bull-board/fastify`; Redis client; Zod; React 19; Vite; React Router; TanStack Query; React Hook Form; shadcn/ui with Tailwind CSS and Recharts

**Storage**: PostgreSQL with pgvector (`vector(1536)`), dedicated Redis cache, dedicated persistent Redis queue store, immutable displayed-answer and approved-source snapshots

**Testing**: Vitest with V8 coverage, Fastify `inject`, React Testing Library, user-event, MSW, Testcontainers for PostgreSQL/pgvector and Redis, Playwright for critical end-to-end paths

**Target Platform**: Modern evergreen browsers; Linux containers for API, web, PostgreSQL/pgvector, and Redis

**Project Type**: Web application with independently deployable SPA and HTTP API in a pnpm monorepo

**Performance Goals**: 95% of answered searches visible within 2 seconds; dashboard for up to 12 months visible within 3 seconds for 95% of loads; analytics updated within 1 minute

**Constraints**: At least 90% correct top result on the labeled retrieval set; generated text must be grounded in one approved FAQ; at most six recent messages are sent for conversational context; OpenAI response storage is disabled; 100 concurrent chat sessions; cache Redis failure must not break chat; BullMQ jobs are at-least-once and therefore idempotent; queue dashboard is admin-only and read-only in production; optimized production images; no secrets or raw FAQ content in queue payloads, browser bundles, logs, or repository

**Scale/Scope**: Single organization MVP; public anonymous chat; one administrator role; five main capabilities (chat, unanswered-question triage, FAQ administration, analytics, authentication); 100 concurrent sessions; initial FAQ corpus expected below 100,000 entries

## Constitution Check

*GATE: Passed before Phase 0 and re-checked after Phase 1.*

The project constitution is ratified at version 1.0.0 and provides the project-wide gates below.
The design satisfies those gates without a documented exception:

- **KISS**: PASS — native pnpm workspaces; no monorepo orchestrator, event bus, microservices, or speculative generic abstractions.
- **SOLID and dependency direction**: PASS — domain and application layers depend only on their own types and ports; infrastructure adapters depend inward.
- **Hexagonal/Clean Architecture**: PASS — strict in the API; pragmatic feature boundaries in the web app to avoid frontend ceremony.
- **Clean, small, explainable English code**: PASS — one use case per file, explicit names, constructor or function injection, no generic `BaseService`, `BaseRepository`, or catch-all `utils`.
- **Testability**: PASS — ports for time, IDs, embeddings, cache, and persistence; unit coverage concentrated on domain/application rules with real adapter integration tests.
- **Approved stack**: PASS — React, Node.js, pnpm monorepo, PostgreSQL/pgvector, Redis, OpenAI, BullMQ with Bull Board, shadcn/ui, and separate development/production Docker definitions.
- **GitHub delivery**: PASS — CI and repository workflow are designed for GitHub; remote publication occurs during implementation/release, not planning.
- **Post-design re-check**: PASS — the data model, API contract, and quickstart preserve all gates without justified violations.

## Architecture

### Dependency rule

```text
HTTP / PostgreSQL / Redis / OpenAI adapters
                    ↓
          Application use cases
                    ↓
            Domain model/rules
```

- Domain code imports no Fastify, database, Redis, OpenAI, or UI types.
- Application code declares input/output ports and orchestrates domain behavior.
- Adapters translate external data at the boundary.
- `bootstrap` is the only API composition root.
- Modules collaborate through application ports, not by importing another module's database adapter.
- Shared contracts contain transport schemas only; they are not domain entities.

### Retrieval flow

1. Validate a maximum of six recent user/assistant messages and the current question.
2. When context exists, ask the conversational model to rewrite the current message as a
   standalone search question without answering it.
3. Normalize that query while retaining the original text for the interaction record. Besides
   accents, punctuation, and casing, remove neutral definite articles immediately before
   possessives so equivalent wording reaches the exact-match path.
4. Check a versioned Redis key derived from the normalized standalone query.
5. On a miss, create an OpenAI embedding using `text-embedding-3-small` with 1536 dimensions.
6. Run semantic pgvector and Portuguese lexical/fuzzy retrieval for every non-exact query. Lexical
   retrieval covers canonical questions, aliases, and approved answers using stemming plus trigram
   similarity for related words and small typing errors.
7. Merge candidates by FAQ identity, retaining the strongest evidence from each retrieval strategy.
8. Accept exact normalized matches immediately; otherwise apply configurable thresholds:
   - `>= 0.78`: answer with the best approved FAQ.
   - `0.70–0.78`: do not claim a definitive answer; invite rephrasing and optionally show approved suggestions.
   - `< 0.70`: record as unanswered and show the fallback channel.
9. Cache successful retrievals for 15 minutes with jitter and unanswered results for at most 2 minutes.
10. For an accepted FAQ, ask the conversational model for a concise Portuguese response using only
   the selected question and answer. If generation fails, display the approved answer verbatim.
11. When no candidate is reliable, explicitly acknowledge that the answer is unknown and ask the
    model only for a contextual clarification without factual claims; provider failure returns
    deterministic reformulation guidance. After two prior unanswered outcomes, the next miss skips
    clarification and returns deterministic human-handoff wording.
12. Render assistant Markdown without enabling raw HTML and always persist the displayed response
    and approved-source snapshots, including cache hits.

Thresholds are configuration defaults, not permanent truth. They must be calibrated against
Portuguese paraphrases, typos, acronyms, and unrelated questions before release. PostgreSQL
lexical/fuzzy retrieval is the deterministic path when OpenAI embeddings are unavailable; the
implemented hybrid merge keeps the strongest evidence per FAQ without blending answer content.

### Failure and privacy rules

- Redis errors fail open and are never cached as application errors.
- OpenAI calls use bounded retry; interpretation failure uses the original question, retrieval failure uses exact/full-text fallback, and response-generation failure returns the approved FAQ verbatim.
- PostgreSQL failure returns a stable service error; the system never claims to have recorded an interaction it could not persist.
- Only the current question, at most six recent anonymous messages, and one selected approved FAQ
  are sent to OpenAI. User identifiers, IP addresses, and authentication data are excluded, and
  Responses API storage is disabled.
- The OpenAI key exists only in server-side secret configuration.
- Raw question text is not written to ordinary application logs.
- FAQ changes increment a knowledge-base version after commit; versioned cache keys provide safe invalidation.
- An FAQ is excluded from semantic search while its embedding is pending or failed.

### Unanswered-question triage flow

1. An unanswered interaction is inserted together with an upsert of its `KnowledgeGap`, grouped by deterministic normalized-question hash.
2. The admin inbox reads the persisted cases, not transient Redis data, and supports state, frequency, date, and category filters.
3. Resolving a case accepts a canonical question, approved answer, category, optional aliases, and an idempotency key.
4. A short PostgreSQL transaction locks the gap, verifies its expected version, creates or updates an `embedding_pending` FAQ, stores a pending resolution and narrow outbox message, marks the gap `resolving`, and returns `202 Accepted`.
5. The queue relay publishes the committed outbox message to BullMQ with deterministic job ID `faq-embedding-{faqId}-v{contentVersion}` and marks it published. Reconciliation republishes any committed but unpublished message after Redis recovery.
6. A BullMQ worker from the same API codebase loads current content from PostgreSQL, requests the OpenAI embedding outside database locks, and reports progress without placing question or answer content in Redis.
7. A completion transaction conditionally stores the vector for the current FAQ content version, activates the FAQ, marks the resolution and gap resolved, appends an audit event, and increments the knowledge-base version.
8. Provider failure uses bounded BullMQ retries. Permanent or exhausted failure marks the resolution failed and returns the gap to `open`; stale embedding results become harmless no-ops.
9. Concurrent, duplicated, stalled, or retried jobs are safe because PostgreSQL resolution state and content-version guards provide correctness beyond BullMQ job deduplication.
10. Historical interactions remain `unanswered`; the gap resolution is a separate fact. Analytics distinguishes historical unanswered occurrences from the current open backlog.
11. Dismiss and reopen actions append audit events. Dismiss requires a reason and never deletes occurrences.

The PostgreSQL outbox bridges the database/Redis transaction boundary; BullMQ handles delivery, retry, rate limiting, stalled-job recovery, and operational visibility. Both relay and worker run from the same backend image with separate start commands.

### BullMQ topology and policy

- Queue name: `faq-embeddings`, with an environment-specific BullMQ prefix.
- Job name: `prepare-faq-embedding`; payload contains only `faqId`, `contentVersion`, and `resolutionId`.
- Delivery semantics: at least once. Domain effects are idempotent and conditionally committed by content version.
- Default attempts: 5 with exponential backoff starting at 2 seconds and jitter; non-recoverable validation/configuration failures stop immediately. The OpenAI SDK uses at most one internal retry so BullMQ remains the primary retry controller.
- Default worker concurrency: 5, configurable, with initial global concurrency 10. A global limiter protects the OpenAI quota, initially 60 jobs per minute and configurable by environment.
- Worker connections use `maxRetriesPerRequest: null`; API/relay queue producers fail quickly and rely on the committed outbox for later reconciliation.
- BullMQ Redis uses AOF persistence and `maxmemory-policy noeviction`. It is separate from the disposable answer-cache Redis because cache eviction policy is incompatible with queue safety.
- Completed jobs are retained for up to 7 days and 1,000 records; failed jobs for up to 30 days and 5,000 records. PostgreSQL remains the durable business audit trail.
- Workers handle `SIGTERM`/`SIGINT` with graceful `worker.close()` and a bounded container grace period. Stalled and error events are logged with identifiers, not content.
- Modern BullMQ stalled-job recovery is used; no obsolete `QueueScheduler` is added.

### Queue dashboard

- Bull Board uses `BullMQAdapter` and `FastifyAdapter`, mounted at `/admin/queues`.
- The route is protected by the same administrator session middleware as the dashboard and is additionally restricted to an internal network, VPN, or protected reverse-proxy route in production.
- Production uses `readOnlyMode: true`, hides Redis connection details, and redacts job data/return values. Business retries use the audited application endpoint.
- Local development may enable Bull Board retry/clean actions only through an explicit environment flag.
- The dashboard is operational tooling; queue state is never used as the source of truth for FAQ or knowledge-gap business status.

## Project Structure

### Documentation (this feature)

```text
specs/001-faq-chatbot-analytics/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── src/
│   │   ├── bootstrap/
│   │   ├── infrastructure/
│   │   │   ├── config/
│   │   │   └── queue/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── faq/
│   │   │   ├── chat/
│   │   │   ├── knowledge-gaps/
│   │   │   └── analytics/
│   │   │       ├── domain/
│   │   │       ├── application/
│   │   │       └── adapters/
│   │   │           ├── inbound/http/
│   │   │           └── outbound/
│   │   └── shared/
│   │       └── domain/
│   └── tests/
│       ├── contract/
│       ├── integration/
│       └── unit/
│   └── commands/
│       ├── start-api.ts
│       ├── start-worker.ts
│       └── relay-outbox.ts
└── web/
    ├── src/
    │   ├── app/
    │   ├── features/
    │   │   ├── auth/
    │   │   ├── chat/
    │   │   ├── dashboard/
    │   │   ├── knowledge-gap-admin/
    │   │   └── faq-admin/
    │   └── shared/
    │       └── api/
    └── tests/
        ├── integration/
        └── unit/

packages/
├── contracts/
├── ui/
└── config/

tests/
└── e2e/

docker/
├── api.Dockerfile
├── web.Dockerfile
└── web-server.conf

compose.yaml
compose.production.yaml
pnpm-workspace.yaml
package.json
pnpm-lock.yaml
```

Each API module uses the same three boundary names only where needed. Domain and application code remain inside `apps/api` rather than becoming premature workspace packages. `packages/ui` contains reusable shadcn primitives and theme tokens, while business-facing components stay with their feature.

**Structure Decision**: Use a native pnpm workspace monorepo with `apps/api`, `apps/web`, and only three narrow shared packages. Do not add Turborepo or Nx initially; root recursive scripts are sufficient and more consistent with KISS. Add build orchestration only after measured CI or build performance warrants it.

## Detailed Design Decisions

### API

- Fastify provides a small HTTP surface, schema validation, structured errors, and socket-free route tests.
- Drizzle provides typed PostgreSQL schemas and explicit SQL migrations, including `CREATE EXTENSION vector`.
- Zod schemas in `packages/contracts` are the request/response source of truth at HTTP boundaries.
- Admin authentication uses a server-side session referenced by an `HttpOnly`, `Secure`, `SameSite` cookie, CSRF protection on mutations, rate-limited login, and secrets-provided bootstrap credentials for the MVP.
- Knowledge-gap mutations require an `Idempotency-Key` header and optimistic version to make retries and concurrent actions safe.
- Resolution requests create transactional outbox work and report `202`; the relay publishes deterministic BullMQ jobs and only the worker may complete a resolution after storing the current embedding.
- The worker uses content-version guards so an older OpenAI response cannot activate stale FAQ text.
- A `QueuePublisher` port keeps BullMQ imports out of domain/application code.
- Bull Board is mounted as an inbound infrastructure route, protected by admin authentication, and has no domain authority.
- Resolution never mutates prior interaction snapshots.
- Error responses use `{ code, message, details?, requestId }`.
- API routes are versioned under `/api/v1`.

### Web

- React Router owns public chat, login, protected dashboard, and FAQ administration routes.
- TanStack Query owns server state. React Hook Form and Zod own form state and validation.
- Feature hooks such as `useAskQuestion`, `useAnalyticsFilters`, and `useFaqForm` coordinate UI and remote state.
- The unanswered inbox uses `useKnowledgeGaps`, `useKnowledgeGap`, and `useResolveKnowledgeGap`; the resolution form reuses FAQ validation contracts and presents pending, failed, and retry states.
- Pure formatting, normalization, and chart transformations remain ordinary functions; hooks are not used as one-line wrappers.
- shadcn/ui provides accessible primitives. Recharts-backed shadcn charts display KPI totals, temporal lines, frequency bars, unanswered lists, and category distribution.
- Components remain small and presentational; feature hooks call a typed HTTP adapter.

### Testing and quality gates

- Unit-test every domain rule, value object, application use case, normalizer, threshold boundary, cache-key rule, state transition, validation schema, hook behavior, and non-trivial formatter.
- Unit-test unanswered grouping, occurrence counts, state transitions, audit events, idempotent resolution, stale-version conflicts, dismiss/reopen rules, and immutable historical interactions.
- Use fake ports for application tests; never call OpenAI in normal unit or CI tests.
- Run real PostgreSQL/pgvector and Redis integration tests through Testcontainers.
- Verify outbox publication recovery, BullMQ deduplication, at-least-once duplicate execution, retry/backoff, rate limiting, stalled recovery, job retention, graceful shutdown, current-content-version guards, and dashboard authorization.
- Verify cosine ordering, filters, migrations, cache TTL, version invalidation, and failure behavior.
- Use Fastify `inject` for route and contract tests.
- Use React Testing Library and MSW for component/hook integration.
- Keep Playwright focused on answered chat, unanswered chat, admin login, unanswered-case resolution, FAQ lifecycle, and dashboard filtering.
- Enforce 90% line and branch coverage for domain/application/shared contracts and 80% overall. Exclude generated shadcn code, migrations, and generated coverage artifacts.
- Require a regression test for every fixed defect. Do not pursue meaningless 100% coverage.

### Docker and delivery

- `compose.yaml` is development-only: API watch mode, Vite HMR, pgvector PostgreSQL, Redis, health checks, named data volumes, and source synchronization without host `node_modules`.
- `compose.production.yaml` contains production services with no bind mounts or dev dependencies.
- Production runs API, outbox relay, and BullMQ worker services from the same API image with different start commands.
- Queue Redis is persistent with AOF and `noeviction`; cache Redis is a separate disposable service with an eviction policy suitable for caching.
- Bull Board is mounted by Fastify at `/admin/queues`, is not exposed unauthenticated, and production ingress restricts the route to trusted administrative access.
- API and web use separate multi-stage Dockerfiles.
- The API runtime copies built JavaScript and pruned production dependencies only, runs as non-root, and uses an init process.
- The web build produces static assets served by an unprivileged server with SPA fallback, compression, immutable asset caching, and a health endpoint.
- Images use pinned Node 24 LTS patch tags/digests and frozen pnpm lockfiles.
- GitHub Actions runs format, lint, typecheck, unit, integration, build, Playwright smoke, and image-build checks on pull requests. Publishing images or releases occurs only after all gates pass.

## Complexity Tracking

No constitution or stakeholder gate violations require justification.
