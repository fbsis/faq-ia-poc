# Quickstart Validation Guide

This guide describes how to validate the planned system after implementation. It does not replace the API contract in [contracts/openapi.yaml](./contracts/openapi.yaml) or the entity rules in [data-model.md](./data-model.md).

## Prerequisites

- Docker Engine with Docker Compose 2.22 or newer
- Node.js 24 LTS
- Corepack-enabled pnpm 10
- An OpenAI API key with embeddings and Responses API access

## Configuration

Copy the committed example environment file and provide local secrets:

```bash
cp .env.example .env
```

Required values:

```text
OPENAI_API_KEY
ADMIN_EMAIL
ADMIN_PASSWORD
SESSION_SECRET
```

Do not commit `.env`.

## Start development services

```bash
corepack enable
pnpm install --frozen-lockfile
docker compose up --build
```

Development containers synchronize the workspace dependencies from `pnpm-lock.yaml` before
starting their watch processes. Named `node_modules` volumes are therefore refreshed when a
dependency changes without requiring the database or queue volumes to be deleted. A shared pnpm
store volume reuses downloaded packages without writing package cache files into the repository.

Expected healthy services:

- web application;
- API;
- PostgreSQL with pgvector enabled;
- Redis cache;
- persistent Redis queue store;
- BullMQ worker and outbox relay.

Validate health:

```bash
curl --fail http://localhost:3000/health
curl --fail http://localhost:8080/health
```

## Run quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm build
pnpm test:e2e
```

Expected outcomes:

- all commands exit successfully;
- domain/application/shared contract coverage is at least 90% for lines and branches;
- overall coverage is at least 80%;
- no normal test calls the live OpenAI API.

## Validate FAQ lifecycle

1. Sign in with the configured administrator.
2. Create an active category.
3. Create an FAQ with a Portuguese question, at least one paraphrase, and an approved answer.
4. Confirm the FAQ moves through embedding preparation and becomes active.
5. Ask the exact question in the public chat and confirm the approved answer appears.
6. Ask “Como redefino a minha senha?” and confirm it returns the approved answer for “Como redefino
   minha senha?” directly, without presenting an ambiguous suggestion.
7. Ask a broader paraphrase and confirm the same answer appears.
8. Edit the answer, wait for re-embedding, and confirm new chats receive the new answer while old interaction details retain the old snapshot.

## Validate a contextual conversation

1. Start with “Como redefino minha senha?” and confirm the assistant answers naturally from the
   approved FAQ.
2. Continue with a context-dependent question such as “e se eu não tiver acesso ao meu e-mail?”.
3. Confirm the request carries no more than six recent messages and retrieval uses a standalone
   interpretation of the follow-up.
4. Confirm the answer is supported by one approved FAQ and the interaction stores both the exact
   displayed response and its approved source snapshot.
5. Disable the conversational provider after retrieval and confirm the user receives the approved
   FAQ text verbatim rather than an invented response.
8. Deactivate the FAQ and confirm it is no longer returned.
9. Restore that FAQ and confirm it keeps the same identifier, returns to `embedding_pending`,
   becomes `active` after worker processing, and leaves old interaction snapshots unchanged.

## Validate unanswered behavior

1. Ask an unrelated question with no FAQ candidate.
2. Confirm the chatbot explicitly says that it does not know and asks for a useful explanation.
3. Rephrase the unknown question twice and confirm the third unanswered response says that the
   information is absent from the knowledge base and that a person will contact the user.
4. Confirm the dashboard lists all three interactions as unanswered.
5. Confirm no generated or unrelated factual answer is presented.
6. Note that the current anonymous chat does not collect contact details; validate the actual
   outbound contact only after that separate operational flow exists.

## Validate unanswered administration

1. Ask the same unknown question twice and a differently normalized unknown question once.
2. Sign in as administrator and open the unanswered inbox.
3. Confirm the repeated question is one open case with two linked occurrences, while the other question is a separate case.
4. Filter the inbox by open state and sort by frequency and latest occurrence.
5. Open a case and verify its occurrences and audit history.
6. Resolve it by providing a canonical question, approved answer, category, and optional aliases.
7. Confirm the case becomes `resolving`, its FAQ becomes `embedding_pending`, and the request returns without waiting for OpenAI.
8. Open `/admin/queues`, confirm an authenticated read-only Bull Board view, and observe the `faq-embeddings` job.
9. Run/observe the BullMQ worker and confirm the case becomes resolved only after the current FAQ embedding is stored and the FAQ is active.
10. Ask the question again and confirm the approved answer is returned.
11. Confirm the original Interaction records remain historically unanswered while the open-backlog count decreases.
12. Retry the same resolution with the same idempotency key and confirm no duplicate FAQ, outbox message, or effective job is created.
13. Submit two resolutions using the same expected gap version and confirm one succeeds while the other receives the current state.
14. Dismiss another gap with a reason, verify its event, reopen it, and confirm it returns to the open inbox.
15. Simulate an OpenAI embedding failure and confirm BullMQ retries with backoff; after exhaustion, the gap returns to open and the FAQ remains inactive.
16. Edit FAQ content while an older job is running and confirm the stale vector cannot activate the newer content version.

## Validate BullMQ and Bull Board

1. Confirm anonymous and non-admin requests to `/admin/queues` are rejected.
2. Confirm production ingress exposes `/admin/queues` only through trusted administrative access.
3. Confirm the production board is read-only, hides Redis details, and reveals no question/answer content.
4. Stop the queue Redis before resolving a gap; confirm the committed outbox remains pending.
5. Restore queue Redis and confirm the relay publishes exactly one deterministic job.
6. Terminate a worker during an active job, start another worker, and confirm stalled-job recovery completes safely without duplicate domain effects.
7. Send `SIGTERM` during normal work and confirm graceful shutdown stops new claims and allows bounded completion.
8. Confirm transient OpenAI errors retry with exponential backoff and permanent validation failures do not retry.
9. Confirm completed/failed retention limits prevent unbounded Redis growth while PostgreSQL keeps the audit history.

## Validate analytics

Create or seed interactions across multiple dates, categories, answered states, and repeated phrasings. Select a fixed dashboard interval and verify:

- total queries equals the interaction count;
- top questions group equivalent normalized queries;
- unanswered counts and latest dates match source interactions;
- historical unanswered totals remain stable after resolution, while the current open-backlog indicator changes;
- category distribution includes uncategorized queries;
- the time series uses the configured organization time zone;
- all widgets use the same date interval.

## Validate cache behavior

1. Ask the same answerable question twice.
2. Confirm the second retrieval is a cache hit but creates a second Interaction.
3. Stop Redis and ask again.
4. Confirm the request still succeeds through PostgreSQL/OpenAI and records `bypassed`.
5. Edit the FAQ and confirm the knowledge-base version prevents the old cached answer from being served.

## Validate OpenAI failure behavior

Run the API with the embedding adapter configured to simulate a timeout:

1. Ask an exact FAQ question and confirm deterministic fallback can answer it.
2. Ask a semantic-only paraphrase and confirm the system either finds a reliable full-text result or returns the safe unanswered message.
3. Confirm no response is fabricated and no API key or raw question is logged.

## Validate access control

- Anonymous users can access chat but receive an unauthorized response for dashboard and FAQ administration endpoints.
- Invalid login attempts are throttled and return generic messages.
- Successful login uses a secure HTTP-only session cookie.
- State-changing admin requests without a valid CSRF token are rejected.
- Logout invalidates the server-side session.

## Validate production containers

```bash
docker compose -f compose.production.yaml build
docker compose -f compose.production.yaml up
```

Confirm:

- no source bind mounts or development servers are present;
- API and web containers run as non-root users;
- the API, relay, and worker use the same optimized backend image with separate commands;
- queue Redis uses AOF plus `noeviction`, independently from cache Redis;
- Bull Board is accessible only through authenticated API routing;
- only production dependencies and built assets exist in runtime images;
- health checks pass;
- the web server supports SPA fallback and immutable caching for fingerprinted assets.
