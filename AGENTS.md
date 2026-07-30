# Repository Agent Instructions

Before creating, amending, or reorganizing commits in this repository, every agent MUST read and
follow [`.agents/COMMIT_POLICY.md`](.agents/COMMIT_POLICY.md).

Behavior changes MUST use the Red/Green commit sequence defined by that policy: a focused
`test(scope): ...` commit followed immediately by the corresponding `feat(scope): ...` or
`fix(scope): ...` commit. A deliberately failing test commit MUST NOT be pushed without its
passing implementation commit.
