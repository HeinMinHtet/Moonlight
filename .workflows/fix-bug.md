# Workflow: Fix Bug

## When to use

Use when a bug has a known symptom but the root cause is unclear or crosses layers.

## Sequence

1. Capture expected behavior, actual behavior, reproduction steps, and available error or network evidence.
2. Start one read-only investigation subagent and instruct it to read `.agents/bug-investigator.md`. Require a confirmed root cause, minimal fix boundary, risks, and proposed regression test. Wait for the result.
3. Do not implement until evidence supports a cause. If evidence is missing, collect the next safe diagnostic signal first.
4. Start one write-capable subagent and instruct it to read `.agents/backend-implementer.md` and `.agents/test-writer.md`. Give it only the bounded fix and regression test. Do not combine the fix with unrelated refactoring.
5. Start focused read-only review with `.agents/security-reviewer.md` or `.agents/performance-reviewer.md` only when the affected behavior requires it.
6. Run the relevant verification commands and reproduce the original scenario again.

## Verification

- `npm run check` when `server.js` changed
- `npm test` for server, persistence, or pure logic changes
- `npm run test:ui` for React or browser-behavior changes
- `npm run build` for frontend changes
- Re-run the original reproduction and one nearby failure path

## Done when

- The root cause is documented with evidence.
- A regression test fails without the fix and passes with it where practical.
- The original symptom is gone without unrelated behavior changes.
- All relevant verification commands pass.
