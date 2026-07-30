# FAQ AI Proof of Concept

A FAQ chatbot and analytics dashboard powered by React, Node.js, PostgreSQL with pgvector,
Redis, BullMQ, Docker, and OpenAI.

The project is under active implementation.

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
