---
name: verification-before-completion
description: Use before claiming a result, committing, opening a PR, or handing off. Run fresh checks that cover the claim and report what the evidence supports.
---

# Verification Before Completion

1. Identify a check that would fail if the claim were wrong. Match its coverage to the claim.
2. Run the complete relevant check on the current state. Read the full result, including exit code, failures, and warnings.
3. Compare the evidence with each acceptance condition. Address recoverable failures and rerun affected checks. Report remaining gaps and which paths you exercised.

| Claim | Evidence |
| --- | --- |
| Tests pass | Current run with zero failures for the claimed suite |
| Lint passes | Current linter run with zero errors at the claimed scope |
| Build passes | Relevant build exits successfully |
| Bug fixed | Original symptom reproduced before the fix and retested after it |
| Regression test works | Focused test failed for the defect and passed after the fix |
| Performance improved | Baseline and result measured under equivalent conditions |
| Requirements met | Each requested deliverable checked against the change and its normal entry point |
