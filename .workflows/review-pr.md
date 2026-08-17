# Workflow: Review PR

## When to use

Use for a branch, pull request, or explicit patch that needs release-readiness review.

This is a read-only workflow. Do not implement fixes unless the user separately asks for them.

## Sequence

1. Establish the exact review scope and comparison base. If a reliable Git diff is unavailable, state that limitation and review only explicitly supplied files or patches.
2. For a non-trivial diff, run independent read-only review agents in parallel when useful:
   - `.agents/security-reviewer.md` for authorization, sessions, input handling, exports, and data exposure.
   - `.agents/refactor-reviewer.md` for correctness risks hidden by responsibility or dependency problems.
   - `.agents/test-writer.md` in review-only mode for missing behavior and failure-path coverage; do not allow it to edit.
3. Add `.agents/performance-reviewer.md` only when the diff changes polling, rendering frequency, API volume, cleanup, or bundle behavior.
4. Wait for all required results and verify each potential finding against the code and diff.
5. Run relevant verification commands when repository state supports them.
6. Consolidate duplicate findings and report only actionable issues.

## Report format

1. Findings ordered Critical, High, Medium, then Low
2. Tight file and line references
3. Impact and evidence or reproduction steps
4. Smallest recommended correction
5. Test gaps and residual risks
6. Final verdict: **Pass**, **Pass with comments**, or **Block with required changes**

If no actionable findings exist, say so explicitly rather than inventing style comments.
