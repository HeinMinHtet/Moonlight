# Workflow: Add Feature

## When to use

Use for a non-trivial user-facing feature that crosses components, `src/api.js`, server endpoints, persistence, or shared business rules.

Do not use for an isolated copy, styling, or other obvious single-file change.

## Sequence

1. Confirm the requested behavior, permissions, success state, and relevant loading, empty, and error states.
2. Start one read-only planning subagent. Instruct it to read `.agents/architect.md`, `.agents/api-designer.md`, and `.agents/planner.md`, then return a single combined plan covering file ownership, API/data contracts, risks, tests, and implementation order. Wait for it.
3. Resolve material decisions with the user when they would change scope, security, persisted data, or public behavior.
4. Start one write-capable implementation subagent. Instruct it to read `.agents/backend-implementer.md` and `.agents/test-writer.md`, then implement the approved plan and matching tests. Do not start another writer.
5. After implementation, start read-only review using `.agents/security-reviewer.md` when auth, sessions, cookies, roles, permissions, input handling, exports, proxying, or server endpoints changed. Add `.agents/performance-reviewer.md` only for a measured performance risk.
6. If review finds a blocker, send a bounded correction to the same implementation agent or fix it in the primary thread. Re-review only the affected area.
7. Run the verification matrix below and inspect the resulting changes before reporting completion.

## Verification

- `npm run check`
- `npm test`
- `npm run test:ui`
- `npm run build`
- Browser verification of the happy path and at least one relevant failure or permission path when UI behavior changed

## Done when

- The approved behavior works end to end.
- Server-side authorization protects privileged behavior.
- Tests cover the main success path and a meaningful failure path.
- No blocking review finding remains.
- All relevant verification commands pass.
