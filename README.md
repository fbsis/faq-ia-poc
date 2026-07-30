# FAQ AI Proof of Concept

A FAQ chatbot and analytics dashboard powered by React, Node.js, PostgreSQL with pgvector,
Redis, BullMQ, Docker, and OpenAI.

## Local development

Requirements:

- Docker with Compose
- Node.js 24+ and pnpm 10.13.1 for commands executed outside Docker
- An OpenAI API key when `CONVERSATION_PROVIDER` or `EMBEDDING_PROVIDER` is `openai`

Start the complete development environment:

```bash
cp .env.example .env
docker compose up --build
```

The migration service runs before the API starts, so an existing local database is upgraded on
every Compose startup. The services are available at:

- Web application: `http://localhost:5173`
- API health: `http://localhost:3000/api/v1/health`
- Bull Board: `http://localhost:5173/admin/queues/` without authentication in development
- Internal architecture walkthrough: `http://localhost:5173/admin/walkthrough`

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before logging in. Do not commit `.env` or real
credentials.

Useful local commands:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:retrieval
pnpm test:e2e
pnpm build
```

Integration tests require a running Docker daemon because they create isolated PostgreSQL and
Redis containers. E2E tests use the administrator credentials from the environment.

## Architecture

The pnpm monorepo separates the React frontend, Node.js API, shared contracts, and UI primitives.
The backend follows ports-and-adapters boundaries: application and domain code do not depend on
PostgreSQL, Redis, BullMQ, Fastify, or OpenAI implementations. PostgreSQL with pgvector is the
source of truth, Redis provides versioned answer caching, and the transactional outbox feeds
BullMQ workers.

Production uses `compose.production.yaml` and optimized multi-stage images:

```bash
cp .env.production.example .env.production
docker compose -f compose.production.yaml up --build
```

## Troubleshooting

- If the web proxy reports `ECONNREFUSED`, wait for `migrate` and `api` to become healthy, then run
  `docker compose restart api web`.
- If a new dependency is unavailable inside a development container, restart the affected service
  so its entrypoint synchronizes the pnpm workspace.
- If the schema is outdated, run `docker compose run --rm migrate`; migrations are idempotent.
- If an embedding remains failed, use the retry action in the FAQ or unanswered-question
  administration screen and inspect `/admin/queues`.

## Chat capabilities

- Natural multi-turn conversation with bounded recent-message context.
- Hybrid FAQ retrieval using exact matches, aliases, pgvector semantic similarity, Portuguese
  full-text search, and trigram similarity for related words and small typing errors.
- Natural OpenAI responses grounded exclusively in administrator-approved FAQ content.
- Contextual clarification when no reliable answer exists, without inventing an answer.
- Safe Markdown rendering for assistant messages, including lists, links, emphasis, and code.
- Versioned Redis caching with a fail-open path to PostgreSQL retrieval.

## Documentation

- [System Design](docs/system-design.md) — architecture, data flows, API boundaries, reliability,
  security, operations, and implementation milestones.
- [Chat Experience and Retrieval](docs/chat-experience-and-retrieval.md) — conversation behavior,
  hybrid search, Markdown support, safety boundaries, and fallback behavior.
- [Architecture Walkthrough](docs/architecture-walkthrough.md) — a private study guide connecting
  the user journey, code paths, architecture decisions, and their motivation.
