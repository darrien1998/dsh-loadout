---
name: verification-before-completion
description: Use before claiming anything is done, fixed, passing, or ready - before committing, opening a PR, or moving to the next task. Run the command that proves the claim, read its full output, then claim exactly what the output shows.
---

# Verification Before Completion

No completion claim without fresh evidence from this turn.

## Gate

Before any status claim or expression of satisfaction:

1. IDENTIFY the command that proves the claim.
2. RUN it, fresh and complete. Not the earlier run; not a subset.
3. READ the full output: exit code, failure count, warnings.
4. COMPARE: does the output support the claim? No: report the actual state with the evidence. Yes: make the claim with the evidence.

Skipping a step is asserting, not verifying.

## What each claim needs

| Claim | Requires | Not enough |
|---|---|---|
| Tests pass | test output: 0 failures | an earlier run, "should pass" |
| Lint clean | linter: 0 errors | a partial check |
| Build passes | build: exit 0 | lint passing, logs that "look fine" |
| Bug fixed | the original symptom re-tested | code changed, assumed fixed |
| Regression test works | seen red before the fix, green after | passes once |
| Requirements met | each requirement checked against the diff | tests passing |

## Words that mean you have not verified

"should work", "probably", "seems to", "Great!", "Done!" before running anything. Confidence is not evidence. Tiredness is not an exemption. A partial check proves nothing about the rest.

## Say what you observed

"The suite passes" and "the change is correct" are different sentences; the first has a receipt. Name the paths your checks exercised: a path you did not exercise is unverified whatever the suite says. Ask what the evidence would look like if you were wrong; if it would look the same, it is not evidence yet.
