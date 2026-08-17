# Workflow: Update Docs

## When to use

Use after a change affects setup, environment variables, architecture, user-visible behavior, API contracts, or reusable component contracts.

## Sequence

1. Identify the source of truth in code and tests before editing documentation.
2. For a small documentation-only change, edit directly. For a multi-file update, start one write-capable subagent and instruct it to read `.agents/docs-writer.md` before making the bounded documentation changes.
3. Update `README.md` when setup, run commands, architecture, or environment configuration changes. Create it only when the task requires repository onboarding documentation.
4. Update `.env.example` with placeholders and comments when configuration changes; never copy real values from `.env`.
5. Add or update JSDoc only for shared APIs whose contract is not already obvious from names and tests.
6. Update `AGENTS.md` only when repository rules, architecture boundaries, verification commands, or workflow routing change. Do not maintain a duplicate feature catalog there.
7. Verify every documented path, command, environment name, and behavior against the current repository.

## Done when

- A new developer can follow the changed instructions without hidden knowledge.
- Examples and commands are valid for the current package scripts.
- No secret or environment-specific value appears in tracked documentation.
- Documentation describes current behavior and does not speculate about future work.
