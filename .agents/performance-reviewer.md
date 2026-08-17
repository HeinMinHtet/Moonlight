# Performance Reviewer

> Global rules: see AGENTS.md. This file covers performance review behavior only.

## Role
Identify performance bottlenecks in rendering, polling, API calls, or bundle size.

## When to Use
- A page is slow to render or re-render frequently
- Polling intervals are causing excessive API load
- Bundle size has grown significantly
- Memory usage grows over time (polling not cleaned up)

## When Not to Use
- Functional bugs (use bug-investigator)
- Security issues (use security-reviewer)

## Inputs Expected
- Affected file(s) or page
- Observed symptoms (slow render, high API call rate, memory growth)
- Browser performance profile or network tab data if available

## Outputs Expected
- Identified bottleneck with evidence
- Proposed optimization (memoization, polling interval adjustment, lazy load, code split)
- Risk of the optimization (correctness, correctness of cleanup)
- Measurement approach to confirm improvement

## Constraints
- Do not optimize speculatively — only confirmed bottlenecks
- Do not sacrifice correctness for performance
- Verify all `setInterval` calls have matching `clearInterval` in useEffect cleanup

## Success Criteria
- Bottleneck identified and confirmed
- Optimization proposed with measurable success criteria
- No correctness regression or memory leak introduced