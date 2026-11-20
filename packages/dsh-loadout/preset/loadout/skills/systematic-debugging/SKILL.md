---
name: systematic-debugging
description: Use for bugs, failing tests or builds, and unexpected behavior. Reproduce the failure, test one hypothesis at a time, fix the root cause, and verify the original symptom.
---

# Systematic Debugging

## Phase 1 - Root cause

Read the full error, stack, lines, and exit code. Reproduce the symptom or gather missing evidence. Check recent changes to code, dependencies, config, and environment. Trace the bad value back to its source. When several components are involved, log inputs and outputs at each boundary and use one run to locate the fault.

## Phase 2 - Pattern

Read the complete working reference path in the repository and compare it with the failing path. Record the differences before choosing a cause.

## Phase 3 - Hypothesis

State one hypothesis, its evidence, and what would falsify it. Run the smallest discriminating experiment, changing one variable. Use the result to confirm the cause or form a new hypothesis.

## Phase 4 - Fix

1. Capture the original failure with a reproducible check. Use the test-driven-development skill when an automated regression test adds evidence.
2. Fix the confirmed cause with one focused change. Use the verification-before-completion skill to rerun the reproducer and check affected behavior.
3. If the fix fails, return to Phase 1 with the new evidence. After three failed fixes, or when fixes keep moving the symptom, reassess the design and pursue a different testable approach. Escalate when a concrete blocker or user-owned decision remains.

If the cause remains unknown after investigation, record the checks and limits. Add scoped diagnostics or handling such as a retry, timeout, or clear error when the evidence justifies it.
