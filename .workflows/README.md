# Project workflows

These playbooks are routed by the repository root `AGENTS.md`. They are not standalone or automatically registered agents.

Rules shared by every workflow:

1. Do not invoke a full workflow for a trivial, obvious single-file change.
2. Read each named role prompt under `.agents/` before delegating that role.
3. Include the role's relevant constraints, the task scope, expected output, and allowed write behavior in the delegated prompt.
4. Never run more than one write-capable agent at a time.
5. Complete investigation or planning before dependent implementation.
6. Parallelize only independent read-only work.
7. Wait for required delegated results and pass a concise handoff into the next phase.
8. The primary agent owns final decisions, verification, and reporting.
