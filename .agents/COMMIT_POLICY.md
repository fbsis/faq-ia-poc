# Semantic Commit Policy

This policy is mandatory for every contributor and agent working in this repository.

## Commit Format

Every commit MUST follow Conventional Commits:

```text
type(scope): concise imperative description
```

Allowed types:

- `feat`: new user-visible or application behavior;
- `fix`: correction of defective behavior;
- `test`: tests and test-only fixtures;
- `docs`: documentation only;
- `chore`: repository maintenance with no application behavior;
- `build`: build system or dependency changes;
- `ci`: continuous-integration changes;
- `refactor`: behavior-preserving production-code changes;
- `perf`: measurable performance improvements.

Scopes MUST be short, lowercase, and identify the affected feature or subsystem. Descriptions MUST
state the outcome precisely and MUST NOT use vague messages such as `updates`, `changes`, or
`fixes`.

## Red/Green Commit Sequence

Every behavior change MUST be represented by two adjacent commits:

1. Create `test(scope): ...` first. It MUST contain only tests and fixtures used exclusively by
   tests, MUST express the expected behavior, and SHOULD fail for the intended reason before the
   implementation exists.
2. Create `feat(scope): ...` or `fix(scope): ...` immediately afterward. It MUST contain the
   production implementation and only the minimum supporting configuration or refactoring needed
   to make the preceding tests pass.

The test commit MUST NOT contain production implementation. The implementation commit MUST NOT
introduce tests that belong to the behavior being implemented. Unrelated refactoring MUST use a
separate `refactor(scope): ...` commit.

Example:

```text
test(chat): cover unanswered question fallback
feat(chat): persist grouped unanswered questions
```

## Validation and Push Rules

- Confirm the staged file list and staged diff before every commit.
- Stage only files belonging to the commit's stated purpose.
- Verify that the test commit fails for the expected reason before writing production code.
- Verify that the focused tests and all required quality gates pass after the implementation
  commit.
- Keep each Red/Green pair adjacent so reviewers can understand the intended behavior and its
  implementation together.
- A deliberately failing `test` commit MUST NOT be pushed by itself. Push only after its paired
  implementation commit passes the required checks.
- Never commit secrets, local environment files, generated credentials, or unrelated workspace
  changes.

## Changes That Do Not Require a Red/Green Pair

Documentation, planning artifacts, agent configuration, CI configuration, build configuration,
and repository maintenance MAY use one focused semantic commit when they do not change executable
application behavior. If such a change does alter behavior, it MUST follow the Red/Green sequence.
