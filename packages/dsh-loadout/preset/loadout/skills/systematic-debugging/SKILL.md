---
name: systematic-debugging
description: Use for any bug, failing test, build failure, or unexpected behavior, before proposing a fix. Root cause first, one hypothesis at a time, a failing test before the fix. Use especially under time pressure, when a quick fix looks obvious, or when a previous fix did not work.
---

# Systematic Debugging

No fix without a root cause. A symptom fix is a failure.

## Phase 1 - Root cause

1. Read the whole error: message, stack, line numbers, exit code. It often names the answer.
2. Reproduce reliably. Not reproducible: gather more data, do not guess.
3. Check what changed: diff, recent commits, dependencies, config, environment.
4. Trace backward from where the bad value is observed to where it is first produced, and fix at the source. Where a defect becomes visible is downstream of where it is created.
5. Multi-component systems: log what enters and leaves each boundary, run once, and let the evidence name the failing component before you touch anything.

## Phase 2 - Pattern

Find working code in this repository that does the same thing. List every difference from the broken path, however small. Read reference implementations completely; do not skim.

## Phase 3 - Hypothesis

State one hypothesis - "X is the cause because Y" - and what would falsify it. Test it with the smallest possible change, one variable at a time. Wrong: form a new hypothesis; do not stack fixes. Unsure: say so and investigate more.

## Phase 4 - Fix

1. Capture the defect with a failing regression test when useful (load the test-driven-development skill). Otherwise record a reproducible check of the original symptom.
2. One fix, at the root cause. No "while I'm here" edits.
3. Verify with the verification-before-completion skill: the regression check passes, relevant behavior still works, and the original symptom is gone.
4. Fix failed: back to Phase 1 with the new information. Three fixes failed: stop and question the design with the user; each fix surfacing a new problem elsewhere means the structure is wrong, not the hypothesis.

## Red flags - stop, return to Phase 1

| Thought | Reality |
|---|---|
| "Quick fix now, investigate later" | The first fix sets the pattern. |
| "Just try changing X" | A guess that works is a bug you have not found yet. |
| "Change several things, run tests" | You cannot tell which one worked. |
| "It's probably X" | Probably is a hypothesis; test it. |
| "One more attempt" (after 2+) | Three failures is a design problem. |
| "The issue is simple, skip the process" | Simple bugs have root causes too, and the process is fast for them. |

No root cause after a full investigation: document what was checked, add handling (retry, timeout, clear error) and logging. Most "no root cause" cases are incomplete investigation.
