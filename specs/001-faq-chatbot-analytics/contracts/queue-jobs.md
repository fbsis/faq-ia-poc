# Queue Contract: FAQ Embeddings

## Queue

- Name: `faq-embeddings`
- Environment isolation: BullMQ `prefix`
- Producer boundary: `QueuePublisher` adapter
- Consumer: backend `start-worker` command
- Dashboard: Bull Board at `/admin/queues`

## Job: `prepare-faq-embedding`

Payload:

| Field | Type | Required | Purpose |
|---|---|---|---|
| `faqId` | UUID | Yes | Load the FAQ from PostgreSQL |
| `contentVersion` | positive integer | Yes | Reject stale work |
| `resolutionId` | UUID | No | Complete a knowledge-gap resolution |

No question text, answer text, user data, credentials, or API keys may appear in payloads, progress, return values, or job logs.

Job ID:

```text
faq-embedding-{faqId}-v{contentVersion}
```

The job ID assists deduplication while retained in Redis. Correctness must not depend on retention because BullMQ is at-least-once; PostgreSQL version and resolution guards make duplicate execution a no-op.

## Processing states

```text
waiting/delayed → active → completed
                     └──→ delayed (recoverable retry)
                     └──→ failed  (exhausted/permanent)
```

Application effects:

- Success for current version: store vector, activate FAQ, complete resolution if present, resolve gap, increment knowledge-base version.
- Success for stale version: no-op completion with a non-sensitive stale result.
- Recoverable failure: throw `Error` and use exponential retry.
- Permanent validation/configuration failure: stop retrying and record a stable error code.
- Exhausted resolution failure: mark resolution failed, return gap to open, keep FAQ inactive.

## Operational defaults

- Attempts: 5
- Backoff: exponential, starting at 2 seconds, with jitter
- Worker concurrency: 5, environment-configurable
- Global concurrency: 10 initially, environment-configurable
- Global limiter: 60 jobs/minute initially, environment-configurable
- OpenAI SDK retries: at most 1 per BullMQ attempt
- Completed retention: maximum 1,000 and 7 days
- Failed retention: maximum 5,000 and 30 days
- Graceful shutdown: close worker on `SIGTERM`/`SIGINT`
- Queue Redis: AOF enabled, `maxmemory-policy noeviction`

## Dashboard policy

- Same administrator session authorization as the application dashboard
- Production route additionally restricted by internal network, VPN, or protected reverse proxy
- Production `readOnlyMode: true`
- Redis details hidden
- Payload and return-value formatter redacts unexpected fields
- Business retries occur through the audited application endpoint
