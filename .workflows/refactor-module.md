# Workflow: Refactor Module

## When to use

Use for an explicitly behavior-preserving structural change with a clear maintenance benefit.

Do not mix refactoring with a feature or bug fix unless the user approves the expanded scope.

## Sequence

1. Run existing relevant tests to establish a passing baseline. If coverage is insufficient, add characterization tests before moving code.
2. Start one read-only planning subagent and instruct it to read `.agents/refactor-reviewer.md` and `.agents/planner.md`. Require extraction boundaries, dependency direction, contract preservation, risks, and staged order. Wait for the plan.
3. Start one write-capable subagent and instruct it to read `.agents/backend-implementer.md` and `.agents/test-writer.md`. Execute one stage at a time and avoid broad rewrites.
4. Run relevant tests after each stage so the first behavior change is easy to locate.
5. Start final read-only review using `.agents/refactor-reviewer.md`, plus `.agents/security-reviewer.md` if authorization or server boundaries were touched.
6. Run the full verification matrix below.

## Verification

- `npm run check`
- `npm test`
- `npm run test:ui`
- `npm run build`

## Done when

- Public, API, authorization, and persisted-data behavior is unchanged.
- Responsibilities and dependency direction are clearer.
- Existing and characterization tests pass.
- No unresolved behavior-regression finding remains.
