---
name: test-driven-development
description: Use when a behavior change or bug fix warrants an automated regression test. Watch a focused test fail for the right reason, make the minimum change, then verify it passes.
---

# Test-Driven Development

Use a regression test when it captures meaningful behavior and can fail for the defect. For a reversible, low-impact change or a test that would merely mirror implementation, verify the result directly instead.

1. **RED** - Write one focused test against real behavior. Name the behavior, not the implementation. Mock only unavoidable dependencies.
2. **Verify red** - Run it. It must fail for the missing behavior, not from a setup error. If it passes, improve the test before editing production code.
3. **GREEN** - Make the smallest change that passes the test.
4. **Verify green** - Rerun the focused test and relevant existing checks. If it fails, diagnose the code rather than weakening the assertion.
5. **REFACTOR** - Remove duplication or improve names while tests remain green. Add no unrelated behavior.

Before writing a test, name the production change that would make it fail. If none exists, the test adds little evidence. After the change, verify the original symptom directly when practical; a passing suite alone may miss it.
