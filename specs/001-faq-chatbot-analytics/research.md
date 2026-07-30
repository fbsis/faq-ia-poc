# Research: FAQ Chatbot and Analytics Dashboard

## Native pnpm workspace

**Decision**: Use pnpm 10 native workspaces with root recursive scripts and a single lockfile. Do not add Nx or Turborepo initially.

**Rationale**: The repository has two applications and three small shared packages. Native workspaces satisfy dependency linking, version consistency, and filtered commands with less configuration, which best matches KISS.

**Alternatives considered**: Turborepo aligns well with shadcn monorepo examples and could improve build caching, but it is unnecessary until CI performance is measured. Nx introduces more orchestration than this MVP needs.

## Runtime and API framework

**Decision**: Use Node.js 24 LTS, strict TypeScript ESM, and Fastify.

**Rationale**: An LTS runtime is appropriate for production. Fastify is lean, validates boundaries, and supports fast HTTP tests through `inject`, while leaving domain/application code framework-free.

**Alternatives considered**: NestJS provides strong conventions but adds decorators and module ceremony that conflict with the requested small, explainable code. Express requires more manual validation and error conventions.

## Hexagonal and Clean Architecture

**Decision**: Apply strict inward dependencies to API feature modules and pragmatic feature boundaries to the web app.

**Rationale**: Ports make OpenAI, Redis, PostgreSQL, clocks, and IDs replaceable and easily faked. Keeping feature modules inside the API avoids turning every layer into a package.

**Alternatives considered**: A package per layer maximizes physical separation but increases cross-package ceremony. A conventional controller/service/repository stack is initially smaller but couples use cases to infrastructure and weakens unit isolation.

## Persistence and migrations

**Decision**: Use PostgreSQL, pgvector, Drizzle ORM, and the `pg` driver with explicit SQL migrations.

**Rationale**: PostgreSQL supports transactional operational and analytical data. pgvector keeps retrieval near FAQ filters. Drizzle exposes vector columns and cosine operations while preserving explicit schemas and migrations.

**Alternatives considered**: Prisma has broader generated tooling but adds abstraction and may require more raw SQL for vector behavior. Raw `pg` is minimal but loses typed schema composition.

## Embeddings

**Decision**: Use OpenAI `text-embedding-3-small` at its default 1536 dimensions behind an `EmbeddingProvider` port. Persist the model, dimensions, and content version with each embedding.

**Rationale**: It is suitable for cost-sensitive FAQ retrieval and fits pgvector's indexed `vector(1536)` representation. The official OpenAI guide documents its 1536-dimensional default.

**Alternatives considered**: `text-embedding-3-large` defaults to 3072 dimensions and should be adopted only if a labeled evaluation demonstrates a meaningful recall gain. Dimension reduction is unnecessary for the expected initial corpus.

## Similarity retrieval

**Decision**: Use cosine similarity, top five candidates, exact search as the validation baseline, and an HNSW cosine index for production scale. Start with configurable thresholds of 0.78 accepted and 0.70 ambiguity floor.

**Rationale**: HNSW offers strong speed/recall without an index training phase. Explicit thresholds prioritize precision and prevent confident but incorrect responses.

**Alternatives considered**: IVFFlat uses less memory but needs training/tuning. Vector-only fixed thresholds without evaluation are unsafe. Hybrid full-text/vector ranking is deferred until Portuguese evaluation data proves it beneficial.

## OpenAI responsibility and failure behavior

**Decision**: OpenAI generates embeddings only. Responses always come from active, administrator-approved FAQ entries.

**Rationale**: Retrieval-only AI preserves auditability, avoids hallucinations, and directly satisfies the known-answer FAQ use case.

**Alternatives considered**: Generating or rewriting answers could improve conversational tone but creates correctness, privacy, and audit risks outside the approved scope.

## Redis caching

**Decision**: Use cache-aside with keys containing a normalized-question hash, knowledge-base version, locale/category scope, and embedding model. Cache positive results for 15 minutes with jitter and negative results for at most 2 minutes.

**Rationale**: Versioned keys make FAQ changes atomically invalidate future reads. Short negative caching avoids repeatedly embedding unknown questions without hiding newly added answers. PostgreSQL remains the source of truth and interactions are recorded even on cache hits.

**Alternatives considered**: Direct deletion is race-prone and difficult for semantically related keys. Caching semantic neighbors may return false positives and is deferred.

## React application

**Decision**: Use React 19 with Vite, React Router, TanStack Query, React Hook Form, Zod, shadcn/ui, Tailwind CSS, and Recharts-backed shadcn charts.

**Rationale**: The application is a client-rendered chat/admin dashboard and does not require server rendering. These tools keep remote state, forms, contracts, and accessible UI concerns explicit.

**Alternatives considered**: Next.js adds server-rendering and full-stack conventions not needed with a separate API. Redux or Zustand is unnecessary until genuine cross-feature client state appears.

## Hooks

**Decision**: Use hooks to coordinate server state, forms, authentication, filters, and UI lifecycles; keep business rules and data transformations as pure functions.

**Rationale**: This provides the requested clean hook-based API without obscuring simple logic or making rules difficult to test.

**Alternatives considered**: Wrapping every helper in a hook increases indirection. Large page components with inline effects are harder to test and explain.

## Administrator authentication

**Decision**: Use one MVP admin role with server-side sessions, secure cookies, CSRF protection for mutations, login throttling, and credentials supplied through secrets.

**Rationale**: It avoids browser token storage and meets the restricted-dashboard requirement with minimal account-management scope.

**Alternatives considered**: JWTs in local storage increase exposure. Full identity and role management is beyond the single-organization MVP.

## Unanswered-question administration

**Decision**: Persist a dedicated `KnowledgeGap` grouped by deterministic normalized-question hash, link every unanswered Interaction occurrence to it, and keep append-only resolution and action audit records.

**Rationale**: Querying raw interactions alone can display unanswered questions but cannot safely model open, resolved, dismissed, and reopened work. A small aggregate provides an explicit workflow while preserving immutable interaction history.

**Alternatives considered**: Mutating old Interactions to `answered` would falsify what the user originally experienced. Semantic auto-clustering could merge unrelated questions and is deferred; deterministic grouping is explainable and safe.

## Unanswered-case resolution transaction

**Decision**: In one short transaction, lock the gap, enforce its expected version and idempotency key, create or update an `embedding_pending` FAQ, and insert a PostgreSQL outbox message. A relay publishes a deterministic BullMQ job, and a same-codebase BullMQ worker calls OpenAI outside the lock and conditionally completes the FAQ/gap only for the current content version.

**Rationale**: The gap is reported resolved only when its answer is searchable. The outbox prevents a committed gap transition from losing its embedding work, while row locks, content versions, and idempotency prevent duplicates and stale vectors.

**Alternatives considered**: Synchronous OpenAI calls make HTTP actions slow and create awkward partial failures. Marking a gap resolved before embedding risks unusable knowledge. Publishing only to Redis cannot atomically commit alongside PostgreSQL. The selected narrow outbox bridges that boundary without becoming a general event system.

## BullMQ worker

**Decision**: Use BullMQ 5 for `prepare-faq-embedding` jobs with deterministic IDs, five attempts, exponential backoff, configurable local/global concurrency and rate limit, graceful shutdown, and idempotent PostgreSQL completion guards. Configure the OpenAI SDK with at most one internal retry.

**Rationale**: BullMQ provides Redis-backed background processing, retry/backoff, rate limiting, progress, failed-job retention, and stalled-job recovery. BullMQ documents at-least-once behavior and recommends simple idempotent jobs, so PostgreSQL state/version checks—not queue uniqueness—remain the correctness boundary. Limiting SDK retries avoids multiplying provider calls inside every BullMQ attempt.

**Alternatives considered**: A custom PostgreSQL polling worker has fewer dependencies but lacks the requested queue dashboard and mature retry/operational controls. BullMQ Pro is not needed for the single queue and single organization MVP.

## Bull Board dashboard

**Decision**: Use `@bull-board/api`, `@bull-board/fastify`, and `BullMQAdapter`, mounted inside Fastify at `/admin/queues`. Production is admin-authenticated and read-only, hides Redis details, and displays redacted identifier-only payloads.

**Rationale**: Bull Board directly supports BullMQ and Fastify and provides job/queue visibility without a separate public service. Read-only production access prevents untracked operational buttons from bypassing business audit rules.

**Alternatives considered**: A custom React queue dashboard duplicates queue tooling. Exposing writable Bull Board in production allows retries or cleanup outside domain authorization and audit paths. A standalone dashboard container creates another authentication boundary.

## Queue Redis isolation

**Decision**: Run BullMQ on a Redis instance separate from the answer cache. Enable AOF persistence and `maxmemory-policy noeviction` for the queue store.

**Rationale**: BullMQ requires queue keys not to be evicted, while cache Redis should be free to evict cached answers. Separate instances avoid an unsafe policy compromise and isolate cache pressure from job delivery.

**Alternatives considered**: Separate logical Redis databases share one server-wide eviction policy and therefore do not provide the needed isolation.

## Backlog and analytics semantics

**Decision**: Historical unanswered metrics continue to count original Interaction outcomes. The administrative backlog counts `KnowledgeGap` records by their current state.

**Rationale**: Resolving the knowledge gap today does not change the fact that past users received no answer. Separate metrics keep operational backlog and historical service quality truthful.

**Alternatives considered**: Removing resolved occurrences from historical metrics makes trends non-reproducible. Counting every occurrence as a separate admin task makes common gaps unnecessarily noisy.

## Test strategy

**Decision**: Use Vitest broadly, fakes for ports, Testcontainers for PostgreSQL/pgvector and Redis, Fastify `inject`, React Testing Library/MSW, and a small Playwright critical-path suite.

**Rationale**: This maximizes meaningful unit coverage while testing infrastructure where mocks would hide integration defects.

**Alternatives considered**: Chasing 100% global coverage encourages tests of generated UI and trivial lines. Live OpenAI calls in CI are slow, costly, and nondeterministic.

## Docker and GitHub

**Decision**: Use a development Compose file plus a production override and separate multi-stage API/web Dockerfiles. GitHub Actions gates pull requests and builds release images only after tests.

**Rationale**: Development requires watch/HMR and bind synchronization; production requires small, immutable, non-root images without source mounts or dev dependencies.

**Alternatives considered**: A single Dockerfile/Compose behavior for both environments either harms local feedback or bloats and weakens production images.

## Sources

- [OpenAI embeddings guide](https://developers.openai.com/api/docs/guides/embeddings#how-to-get-embeddings)
- [pgvector](https://github.com/pgvector/pgvector)
- [pnpm workspaces](https://pnpm.io/workspaces)
- [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)
- [Fastify testing](https://fastify.dev/docs/latest/Guides/Testing/)
- [Drizzle vector similarity search](https://orm.drizzle.team/docs/guides/vector-similarity-search)
- [React TypeScript](https://react.dev/learn/typescript)
- [shadcn/ui monorepo](https://ui.shadcn.com/docs/monorepo)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/)
- [BullMQ workers](https://docs.bullmq.io/guide/workers)
- [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs)
- [BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production)
- [BullMQ retries](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [BullMQ graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown)
- [Bull Board](https://github.com/felixmosh/bull-board)
- [OpenAI Node SDK retries and timeouts](https://github.com/openai/openai-node)
