# wow-ledger repository guidance

## Product and runtime

- This repository is a React 19 and Vite frontend served through a Node.js ES module gateway in `server.js`.
- Authentication uses Discord OAuth and guild-role checks. This is not a discord.js bot, so do not add bot tokens, Gateway Intents, or discord.js command handlers.
- Use the Node.js version declared in `package.json` and keep secrets only in `.env`. Update `.env.example` with placeholders when configuration changes.

## Architecture boundaries

- `src/components/` owns React rendering and local interaction state.
- `src/api.js` owns browser-to-server HTTP calls and client-facing error mapping. Do not fetch application endpoints directly from components.
- `src/utils/` and `lib/` own reusable pure logic. Prefer pure functions when business rules can be separated from rendering or I/O.
- `server.js` owns static serving, Discord OAuth, sessions, authorization, persistence orchestration, and server-side endpoints. Keep frontend code out of it.
- `test/*.test.js` contains Node test-runner coverage. Colocate Vitest UI tests with their components as `*.test.jsx`.

## Working agreements

- Read the relevant implementation and tests before editing; avoid broad unrelated scans or rewrites.
- Make the smallest coherent change that satisfies the request and preserve existing API and persisted-data contracts unless a breaking change is explicitly approved.
- Never expose OAuth secrets, session secrets, access tokens, internal stack traces, or private user data to the browser or logs.
- Enforce authentication and authorization on the server. Client-side visibility checks are not security boundaries.
- Treat changes to OAuth, cookies, sessions, proxy behavior, role checks, input validation, or data export as security-sensitive.
- Do not silently swallow errors. Present safe user-facing errors and retain useful server-side diagnostics without sensitive values.
- Do not add production dependencies without explaining the need and obtaining approval.

## Verification

- Run `npm run check` after changing `server.js`.
- Run `npm test` after changing `server.js`, `lib/`, Node utilities, persistence, or business rules.
- Run `npm run test:ui` after changing React components, UI utilities, or browser behavior.
- Run `npm run build` after changing frontend source or build configuration.
- For cross-layer changes, run all four commands.
- When UI behavior changes, verify the happy path and at least one relevant empty, loading, permission, or error state in the browser when browser tooling is available.

## Workflow routing

Read the matching playbook before starting non-trivial work:

- New feature: `.workflows/add-feature.md`
- Bug with an unclear cause: `.workflows/fix-bug.md`
- Behavior-preserving refactor: `.workflows/refactor-module.md`
- Pull-request or branch review: `.workflows/review-pr.md`
- Documentation maintenance: `.workflows/update-docs.md`
- Test coverage work: `.workflows/write-tests.md`

For a small, obvious, single-file change, work directly and apply the relevant verification commands instead of invoking a full workflow.

## Subagent policy

Role prompts are Markdown files directly under `.agents/`. They are on-demand instruction fragments, not automatically registered custom agents. When a workflow names a role file, read it and include its relevant constraints and expected output in the delegated task.

Role groups:

- Planning: `.agents/architect.md`, `.agents/api-designer.md`, and `.agents/planner.md`; read-only.
- Investigation: `.agents/bug-investigator.md`; read-only.
- Implementation: `.agents/backend-implementer.md` and `.agents/test-writer.md`; write-capable.
- Review: `.agents/security-reviewer.md`, `.agents/refactor-reviewer.md`, and `.agents/performance-reviewer.md`; read-only.
- Documentation: `.agents/docs-writer.md`; write-capable only when the workflow explicitly requests documentation changes.

Some preserved role prompts use older names such as `JAWS_web`/`JAWS_api`, prescribe `src/__tests__`, or mention missing size thresholds. Treat those as stale examples. This file and the active `.workflows/` playbooks are authoritative: the current boundaries are React -> `src/api.js` -> `server.js`, Node tests belong in `test/*.test.js`, and UI tests are colocated `*.test.jsx` files.

Use subagents only for bounded work where specialization improves the result. Do not delegate trivial changes.

- Never run two write-capable agents at the same time or let multiple agents edit overlapping files.
- Run planning or investigation before implementation when the outcome affects the implementation path.
- Read-only exploration and review may run in parallel only when their tasks are independent.
- Give every delegated agent explicit scope, expected output, and relevant files.
- Wait for required agent results and consolidate them before moving to the next dependent phase.
- The primary agent owns final decisions, conflict resolution, verification, and the user-facing summary.

## Code review rules

- Prioritize broken authorization, data loss, incorrect totals, persistence corruption, unsafe error disclosure, regressions, and missing failure-path tests.
- Require server-side permission checks for every privileged endpoint and action.
- Flag behavior changes without matching tests.
- Avoid style-only findings unless they conceal a correctness, accessibility, maintenance, or security risk.
