# Workflow: Write Tests

## When to use

Use when implemented behavior lacks sufficient regression coverage or when characterization tests are needed before a refactor.

## Sequence

1. Read the implementation, its callers, and nearby tests. Identify observable behavior rather than mirroring implementation details.
2. If the behavior or execution path is unclear, start one read-only subagent and instruct it to read `.agents/bug-investigator.md`; wait for its trace before writing tests.
3. Start at most one write-capable subagent and instruct it to read `.agents/test-writer.md`, or implement directly when the change is trivial.
4. Put Node test-runner tests in `test/*.test.js`. Colocate Vitest component tests with the component as `*.test.jsx`.
5. Cover the main success path and at least one meaningful failure, permission, boundary, or empty-state path.
6. Run the targeted suite, then the related full suite. Run the build when frontend imports or test-related configuration changed.

## Verification

- `npm test` for `test/*.test.js`
- `npm run test:ui` for `*.test.jsx`
- `npm run build` when frontend source, imports, or configuration changed

## Done when

- Tests fail for the intended reason without the covered behavior and pass with it.
- Tests assert public behavior, not private implementation details.
- The related full suite passes.
- Remaining coverage gaps are reported explicitly.
