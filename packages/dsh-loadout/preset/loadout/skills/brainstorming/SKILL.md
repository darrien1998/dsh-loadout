---
name: brainstorming
description: Use before any creative work - a new feature, component, behavior change, or anything with more than one reasonable design. Turns a vague request into an approved design through one-question-at-a-time dialogue. No code until the user has approved a design.
---

# Brainstorming

Turn an idea into an approved design before any implementation.

HARD GATE: no code, no scaffolding, no file changes until you have presented a design and the user approved it. "Too simple to need a design" is where unexamined assumptions waste the most work; a simple request gets a short design, not no design.

## Steps

1. **Explore context first.** Read the relevant files, docs, and recent commits before asking anything. Never ask the user something the repository can answer.
2. **Check scope.** If the request spans several independent subsystems, say so and decompose it; brainstorm the first piece only.
3. **Ask one question per message.** Purpose, constraints, success criteria. Prefer multiple choice. Stop when you can state what you are building and how you will know it works.
4. **Propose 2-3 approaches** with trade-offs. Lead with your recommendation and the reason. YAGNI: strip every feature the goal does not need.
5. **Present the design in sections** scaled to complexity (a few sentences to ~250 words each): architecture, components, data flow, error handling, testing. Ask after each section whether it looks right.
6. **Self-review** before asking for approval: placeholders (TBD/TODO), contradictions between sections, requirements that can be read two ways, scope too large for one implementation pass. Fix inline.
7. **Get explicit approval.** Then implement with the test-driven-development skill. If the user wants a written spec, save it where they say and commit it.

## Design rules

- Units with one purpose, clear interfaces, testable alone. For each unit you can answer: what it does, how it is used, what it depends on.
- In existing code, follow existing patterns. Fold in a targeted improvement only where an existing problem blocks the work; no unrelated refactoring.

## Red flags

| Thought | Reality |
|---|---|
| "This is obvious, I'll just build it" | Obvious to you is an unexamined assumption to the user. Present it; approval takes one message. |
| "I'll ask three questions at once" | Three questions get one vague answer. One at a time. |
| "Let me ask where the code lives" | The repository answers that. Read it. |
