# Chat Experience and Retrieval

This document explains how the public chatbot turns a natural conversation into a grounded,
auditable FAQ response.

## User experience

The chat keeps a bounded history of up to six recent user and assistant messages. Follow-up
questions such as “and if I no longer have access?” can therefore be interpreted in the context
of the previous topic. OpenAI rewrites a context-dependent message into a standalone search query,
but that rewrite does not answer the user or add facts.

When a reliable FAQ is found, the assistant responds naturally in Portuguese. The response may
reorganize the approved content for clarity, but it must use only the selected FAQ question and
answer as its factual source. If response generation fails, the exact approved answer is shown
instead.

When no reliable FAQ is found, the assistant explicitly says that it does not know the answer and
that it may need more explanation. It then asks one contextual clarification that may improve the
next search. It does not guess an answer or use general model knowledge. If OpenAI is unavailable,
the application uses a deterministic clarification asking what the user is trying to do and at
which step the doubt appeared.

Each assistant message in the bounded browser history carries its retrieval outcome. After two
previous `unanswered` outcomes, a third unanswered attempt no longer asks for more context. It says
that the information is not available in the approved knowledge base and informs the user that a
person from the team will contact them to explain the process. This threshold is enforced by the
application, not delegated to OpenAI. The current public chat remains anonymous and does not yet
collect or dispatch contact details; that operational follow-up requires a separate contact flow.

## Hybrid retrieval

Retrieval uses multiple complementary strategies instead of relying on one embedding result:

1. Normalize the standalone question and check the versioned Redis cache. Normalization removes
   accents, punctuation, casing differences, and neutral Portuguese articles immediately before a
   possessive. For example, “como redefino a minha senha” and “como redefino minha senha” become
   the same exact query.
2. Look for an exact match in canonical questions and approved aliases.
3. For every non-exact query, run these searches concurrently:
   - semantic similarity over OpenAI embeddings stored in PostgreSQL with pgvector;
   - Portuguese full-text search over canonical questions, aliases, and approved answers;
   - trigram word similarity over the same approved text.
4. Merge candidates by FAQ identity, retaining the strongest confidence found for each FAQ.
5. Sort the merged candidates and apply configurable confidence thresholds.

Portuguese stemming makes grammatical variations easier to find, while trigram similarity covers
nearby words and small typing errors. Semantic search covers paraphrases whose wording differs
substantially from the approved question.

The default decision bands are:

| Confidence | Behavior |
|---|---|
| `>= 0.78` | Answer using the best approved FAQ |
| `0.70–0.78` | Present the match as a suggestion without claiming a definitive answer |
| `< 0.70` | Record as unanswered; clarify first, then hand off after repeated misses |

Exact approved matches, including equivalent normalized wording, are accepted immediately and
return the approved answer rather than an ambiguous suggestion. The non-exact thresholds are
configuration defaults and must be calibrated against a representative Portuguese evaluation set.

## Markdown messages

Assistant messages support GitHub-Flavored Markdown, including:

- paragraphs and emphasis;
- ordered and unordered lists;
- links;
- inline code and fenced code blocks.

Links open in a new tab with `noopener` and `noreferrer`. Raw HTML processing is not enabled, so
HTML and script content returned by a model or stored answer is not executed by the browser.

## Grounding and failure boundaries

- User-facing factual answers come from one active, administrator-approved FAQ.
- OpenAI response storage is disabled.
- At most six recent anonymous messages and the selected FAQ source are sent for response
  generation.
- Embedding failure does not disable exact, full-text, or fuzzy PostgreSQL retrieval.
- Response-generation failure displays the approved answer verbatim.
- Clarification-generation failure returns safe deterministic guidance.
- Two previous unanswered assistant outcomes trigger deterministic human-handoff wording on the
  next unanswered attempt.
- Redis failures bypass the cache and do not stop the chat.
- The displayed response and approved source snapshots are stored with the interaction for audit.

## Related documentation

- [System Design](system-design.md)
- [Feature Specification](../specs/001-faq-chatbot-analytics/spec.md)
- [Implementation Plan](../specs/001-faq-chatbot-analytics/plan.md)
- [Quickstart](../specs/001-faq-chatbot-analytics/quickstart.md)
