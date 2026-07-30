<!--
Sync Impact Report
- Version change: template (unratified) -> 1.0.0
- Modified principles:
  - Template Principle 1 -> I. Small, Explainable Code
  - Template Principle 2 -> II. Hexagonal Dependency Rule
  - Template Principle 3 -> III. Reliable Data and Grounded AI
  - Template Principle 4 -> IV. Verification at Every Boundary
  - Template Principle 5 -> V. Secure and Observable Delivery
- Added sections:
  - Project-Wide Technical Standards
  - Development Workflow and Quality Gates
- Removed sections: none
- Follow-up TODOs: none
-->
# FAQ Intelligence Platform Constitution

## Core Principles

### I. Small, Explainable Code

Every implementation MUST favor the smallest design that completely satisfies its specification.
Code, identifiers, commits, and technical documentation MUST be written in English. Modules and
functions MUST have one clear responsibility, explicit inputs and outputs, and names that explain
their intent. KISS and SOLID MUST guide design decisions, but abstractions MUST be introduced only
when they remove demonstrated duplication, isolate a real boundary, or enable testing. Generic
`BaseService`, `BaseRepository`, catch-all `utils`, and speculative frameworks are prohibited.
React hooks MUST encapsulate reusable stateful behavior and side effects, while pure business
rules remain framework-independent. This keeps the codebase compact, teachable, and easy to review.

### II. Hexagonal Dependency Rule

Backend features MUST use Hexagonal Architecture and Clean Architecture. Domain code MUST depend
only on domain concepts. Application use cases MAY depend on domain types and declared ports.
Infrastructure adapters MAY depend on application ports, but domain and application layers MUST
NOT import Fastify, PostgreSQL clients, Redis clients, BullMQ, OpenAI SDKs, or other infrastructure
libraries. HTTP handlers, database repositories, queue processors, cache clients, and AI providers
MUST remain replaceable adapters.

Frontend code MUST be organized by feature with presentation, hooks, API access, and shared UI
concerns kept explicit. Business and validation rules shared across boundaries MUST live in
focused packages with stable contracts. Cross-feature imports MUST follow declared public APIs;
hidden coupling and circular dependencies are prohibited. Any exception MUST be documented in the
feature plan's Complexity Tracking section before implementation.

### III. Reliable Data and Grounded AI

PostgreSQL MUST be the source of truth for FAQs, categories, interactions, unanswered questions,
administrative decisions, and analytics data. pgvector MUST support semantic FAQ retrieval.
OpenAI MUST be accessed through an application port and used for embeddings or explicitly
specified AI operations. User-facing answers MUST be grounded in active, approved knowledge-base
content. When retrieval confidence is below the specified threshold, the system MUST record the
question as unanswered instead of inventing an answer.

Redis cache MAY accelerate repeated FAQ searches, but it MUST be fail-open: cache failure MUST
NOT make the source-of-truth query unavailable. Cache keys MUST be versioned, bounded by a TTL,
and invalidated when relevant knowledge changes. BullMQ MUST execute asynchronous work using a
queue-specific Redis instance configured with persistence and `noeviction`, separate from the
disposable cache workload. Database-to-queue publication MUST use a transactional outbox or an
equivalent durability mechanism. Jobs MUST be idempotent, retry-safe, observable, and protected
against stale writes.

Only the minimum required user data MAY be sent to external AI services. Secrets MUST remain
server-side, and sensitive or personal data MUST NOT be placed in logs, cache values, job payloads,
or analytics dimensions.

### IV. Verification at Every Boundary

Every behavior change MUST include automated verification proportional to its risk. Domain rules,
application use cases, validation, cache-key logic, ranking decisions, and job processors MUST
have unit tests. Shared contracts and backend domain/application packages MUST maintain at least
90% line and branch coverage; the repository MUST maintain at least 80% line and branch coverage.
Coverage targets do not justify low-value tests or tests coupled to implementation details.

Adapters MUST have integration or contract tests against their real boundary: PostgreSQL with
pgvector, Redis, BullMQ, HTTP contracts, and OpenAI-compatible fixtures. Normal CI MUST NOT call
the live OpenAI API. React behavior MUST be tested through user-visible outcomes with React
Testing Library and mocked network contracts. Critical chatbot, administration, and dashboard
journeys MUST have end-to-end coverage. Every defect fix MUST add a regression test that fails
without the fix.

### V. Secure and Observable Delivery

Administrative routes, the unanswered-question workflow, analytics, and Bull Board MUST require
authorization. Production Bull Board access MUST be restricted to trusted administrators and
operate as an operational interface, not a public application surface. Authentication, session,
CSRF, input-validation, rate-limit, and output-encoding controls MUST be defined by the relevant
specification and verified at their boundaries.

HTTP requests, outbox events, jobs, and AI calls MUST carry correlation identifiers. Services MUST
emit structured logs and useful latency, error, cache, queue, retrieval, and unanswered-question
metrics without exposing secrets or sensitive content. Health checks MUST distinguish liveness
from readiness. User-facing failures MUST be safe and actionable; operational failures MUST retain
enough context for diagnosis.

## Project-Wide Technical Standards

- The repository MUST be a pnpm workspace monorepo with one lockfile and root-level commands.
- Production application code MUST use strict TypeScript on the active Node.js LTS release.
- The web application MUST use React, Vite, shadcn/ui, accessible primitives, and feature-focused
  hooks. UI copy MAY be Portuguese, but source identifiers and technical documentation MUST be
  English.
- The backend HTTP adapter MUST use Node.js and Fastify. API contracts MUST be schema-validated
  and exposed through a versioned interface.
- Persistent storage MUST use PostgreSQL with the pgvector extension. Schema changes MUST use
  versioned migrations and provide a safe forward and rollback strategy where practical.
- Redis MUST serve repeated-query caching. BullMQ MUST serve background work, and Bull Board MUST
  provide its restricted operational dashboard.
- OpenAI integration MUST be isolated behind ports, configurable by environment, timeout-bound,
  retried only when safe, and replaceable by deterministic test doubles.
- Unanswered questions MUST be stored and available to authorized administrators. An administrator
  MUST be able to review one, create or associate an approved FAQ answer, and preserve the audit
  history of that decision.
- Development and production MUST use separate Docker Compose definitions or explicit profiles.
  Development containers MUST support rapid local feedback. Production images MUST be multi-stage,
  minimal, non-root, health-checked, and contain only runtime dependencies and built artifacts.
- API, outbox relay, and worker processes MAY share one immutable backend image, but MUST start
  through distinct commands and scale independently.
- Source code MUST be hosted in GitHub. Setup, environment variables, migrations, seeding, testing,
  local development, production operation, and troubleshooting MUST be documented.

## Development Workflow and Quality Gates

Every feature MUST progress through specification, clarification when required, planning, ordered
tasks, implementation, and verification. Each feature plan MUST perform a Constitution Check
before design begins and repeat it after design artifacts are complete. A specification MUST state
testable user outcomes and edge cases without hiding architectural changes inside implementation
tasks.

Pull requests MUST be focused and reviewable. Before merge, CI MUST pass formatting, linting,
strict type checking, unit tests, required integration and contract tests, production builds, and
Docker image construction. End-to-end tests MUST gate changes that affect critical journeys.
Database migrations, API contracts, queue payloads, cache behavior, security boundaries, and
observability changes MUST receive explicit review.

New dependencies and abstractions MUST have a concrete use case and a documented maintenance
benefit. Performance-sensitive changes MUST be measured with representative data. Any deliberate
violation of this constitution MUST be recorded in the plan's Complexity Tracking section with
the simpler alternative considered, the reason it is insufficient, the owner, and a removal or
review condition.

## Governance

This constitution governs the entire repository and every present or future specification. It
supersedes conflicting feature plans, task lists, implementation conventions, and review habits.
A feature document MAY strengthen these rules for its scope but MUST NOT weaken them silently.

Amendments MUST be proposed as an explicit constitution change, include a Sync Impact Report,
identify affected specifications or operational practices, and be reviewed before dependent work
is merged. Semantic versioning applies to governance: MAJOR for incompatible principle removal or
redefinition, MINOR for a new principle or materially expanded obligation, and PATCH for
clarifications that do not change obligations.

Every feature plan and pull-request review MUST verify compliance. Reviewers MUST block unexplained
violations. When an amendment changes an existing obligation, affected features MUST receive a
documented migration or follow-up plan. The constitution MUST be reviewed whenever the core stack,
security model, data ownership, AI behavior, or delivery model changes.

**Version**: 1.0.0 | **Ratified**: 2026-07-30 | **Last Amended**: 2026-07-30
