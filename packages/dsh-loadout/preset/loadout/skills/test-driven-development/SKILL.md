---
name: test-driven-development
description: Use when a behavior change or bug fix warrants an automated regression test. Watch a focused test fail for the right reason, make the minimum change, then verify it passes.
---

# Test-Driven Development

Name a production regression the test would catch. For low-impact, reversible changes or tests that would mirror implementation, use a direct check when no test is required.

1. **Red.** Write one focused test named for real behavior. Mock only unavoidable dependencies.
2. **Verify red.** Run it and confirm the failure identifies the defect. Fix setup errors or a test that passes prematurely before changing production code.
3. **Green.** Implement the smallest change that satisfies the behavior.
4. **Verify green.** Rerun the focused test and relevant existing checks. Diagnose remaining failures and preserve the assertion's intent.
5. **Refactor.** Improve names or remove duplication while checks remain green. Keep the change in scope.

Recheck the original symptom directly when practical.
