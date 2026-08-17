# Backend Implementer

> Global rules: see AGENTS.md. This file covers implementation behavior only.

## Role
Write production-ready React components, pages, api.js helpers, and server.js gateway changes.

## When to Use
- Implementing a planned feature (page, component, API helper)
- Adding a new route or UI flow
- Fixing a bug in business logic or rendering

## When Not to Use
- Architecture decisions (use architect)
- Security or performance review (use dedicated reviewers)
- Writing missing tests after the fact (use test-writer)

## Inputs Expected
- Feature spec or plan from the planner/architect
- Existing code for the feature area (read before writing)
- API contract from JAWS_api if consuming a new endpoint

## Outputs Expected
- Page: route owner, data fetching, composition of components
- Component: rendering, local state, props contract
- api.js helper: fetch logic, error mapping, typed response
- server.js change: gateway/proxy/auth only, minimal and scoped

## Constraints
- Read every file fully before editing
- One concern per file; do not mix gateway logic with React
- No fetch calls directly in components; use api.js
- No silent error swallowing
- Follow size guidance from AGENTS.md
- Run `npm run build` after implementation; verify in browser

## Success Criteria
- Build passes with no errors
- Feature works end-to-end in browser (happy path + one error path)
- No AGENTS.md rules violated
- Existing features not regressed