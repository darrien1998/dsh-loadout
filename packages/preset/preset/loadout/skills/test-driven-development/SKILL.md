---
name: test-driven-development
description: Use when implementing any feature or bug fix, before writing production code. One failing test, watched to fail for the right reason, then the minimum code to pass, then refactor while green. Also how a bug fix is proven - the reproducing test is red before the fix.
---

# Test-Driven Development

No production code without a failing test first. If you did not watch the test fail, you do not know it tests the right thing.

## Cycle

1. **RED** - one minimal test for one behavior, named for the behavior, against real code (mock only what is unavoidable).
2. **Verify red** - run it. It must fail, not error, and fail because the behavior is missing. Passes immediately: it tests existing behavior; fix the test. Errors: fix the error, rerun until it fails correctly.
3. **GREEN** - the simplest code that passes. No extra options, no refactoring of other code.
4. **Verify green** - run it. The new test passes, every other test still passes, output is clean. Fails: fix the code, not the test.
5. **REFACTOR** - only while green: remove duplication, improve names, extract helpers. No new behavior.
6. Next test.

Wrote code before the test? Delete it and start from the test. Keeping it "as reference" is testing after.

Exceptions, and only with the user's agreement: throwaway prototypes, generated code, configuration files.

## Example - bug: empty email accepted

```ts
// RED
test('rejects empty email', async () => {
  const result = await submitForm({ email: '' })
  expect(result.error).toBe('Email required')
})
// run: FAIL - expected 'Email required', got undefined

// GREEN
function submitForm(data) {
  if (!data.email?.trim()) return { error: 'Email required' }
  // ...
}
// run: PASS
```

## Good tests

- One behavior per test; "and" in the name means split it.
- The name says the behavior, not "test1".
- Before writing a test, name the production change that would make it fail. None: the test proves nothing.
- Assert on real behavior, never on whether a mock was called.

## Red flags

| Excuse | Reality |
|---|---|
| "Too simple to test" | Simple code breaks; the test takes a minute. |
| "I'll test after" | A test written after passes immediately and proves nothing. |
| "Already tested manually" | No record, no rerun, no edge cases. |
| "Delete hours of work?" | Sunk cost; code you cannot trust is the waste. |
| "The test is hard to write" | The design is hard to use. Simplify the interface. |
| "I must mock everything" | The code is too coupled. Inject the dependency. |

Stuck on how to test: write the API you wish you had, write the assertion first, ask the user.
