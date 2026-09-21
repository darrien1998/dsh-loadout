---
name: brainstorming
description: Use when a feature or behavior change has unresolved design choices that materially affect the result. Inspect context, resolve user-owned choices, and propose the smallest workable design.
---

# Brainstorming

Resolve material design choices before implementation.

1. **Inspect first.** Read relevant code, tests, docs, and recent changes. Do not ask for facts the repository can answer.
2. **Find the real choices.** State the intended result and what remains uncertain. Make reasonable assumptions for reversible implementation details. Ask one focused question at a time only when the user's preference, input, or approval is needed.
3. **Recommend a design.** Compare alternatives only when the trade-off affects the result. Lead with one recommendation and remove features the request does not need.
4. **Scale the plan.** For substantial changes, summarize scope, affected components, data flow, edge cases, and verification. A small change needs only a few sentences.
5. **Follow the request.** If the user asked for a plan or critique, present it. If they asked for implementation, proceed once material choices are resolved. Seek explicit approval only when the user, mode, or an irreversible action requires it.

Keep each unit focused, follow the repository's patterns, and avoid unrelated refactoring.
