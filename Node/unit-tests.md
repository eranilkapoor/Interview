# Unit Testing in Node.js

Node.js ships a built-in test runner via the `node:test` module (stable since Node 20, experimental in 18), paired with the `node:assert` module for assertions. It provides `test()`/`describe()`/`it()` functions for structuring test suites, lifecycle hooks (`before`, `after`, `beforeEach`, `afterEach`), built-in support for `async` tests, subtests, mocking (`node:test`'s `mock` object, stable in recent versions), and `--watch` mode — all without installing any dependency. It's invoked with `node --test`, which auto-discovers files matching common test naming conventions (`*.test.js`, `test-*.js`, files under a `test/` directory, etc.).

Before `node:test` matured, the Node ecosystem relied entirely on userland test frameworks, and they remain extremely common in real codebases: Jest (all-in-one — runner, assertions, mocking, snapshot testing, coverage — historically the most popular, especially in frontend-adjacent stacks), Mocha (a flexible runner typically paired with a separate assertion library like Chai and a mocking library like Sinon), and Vitest (a newer, fast, Jest-API-compatible runner built for ESM/Vite-based projects). The tradeoffs: `node:test` requires zero dependencies and stays in lockstep with the Node version, but has a smaller feature set (e.g., no built-in snapshot testing) and less ecosystem tooling/IDE integration than Jest. Jest and Vitest offer richer built-in features and mocking ergonomics at the cost of being external dependencies with their own version-compatibility surface. Mocha's flexibility (bring-your-own-assertion-library) is valued in some codebases but means more setup decisions.

Mocking in `node:test` is done via `t.mock` (per-test mock context) or the standalone `mock` object, supporting function mocking (`mock.fn()`), method spying on objects (`mock.method(obj, 'methodName')`), and timer mocking (`mock.timers`) to control `setTimeout`/`setInterval`/`Date` in tests without real delays. This mirrors what `jest.fn()`/`jest.spyOn()`/`jest.useFakeTimers()` provide in Jest, and what Sinon provides for Mocha — the concepts (stubbing dependencies, spying on calls, faking time) are consistent across all these tools even though the APIs differ.

Code coverage for `node:test` is available via the `--experimental-test-coverage` flag (reporting statement/branch/function coverage), or via the popular third-party tool `c8` (a wrapper around V8's built-in coverage instrumentation, usable with any test runner including Mocha and `node:test`). Jest and Vitest have coverage built in (via `--coverage`, typically also backed by V8's coverage or Istanbul). Coverage percentage alone is a weak quality signal — 100% coverage doesn't guarantee correct assertions — but it's useful for finding completely untested code paths.

## Examples

```js
// Basic node:test usage: describe/it structure, async tests, and node:assert
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

function add(a, b) {
  return a + b;
}

async function fetchUserName(id) {
  if (id <= 0) throw new Error('invalid id');
  return `user-${id}`;
}

describe('math utils', () => {
  it('adds two numbers', () => {
    assert.strictEqual(add(2, 3), 5);
  });

  it('handles negative numbers', () => {
    assert.strictEqual(add(-2, 5), 3);
  });
});

describe('fetchUserName', () => {
  it('resolves a formatted name for a valid id', async () => {
    const name = await fetchUserName(42);
    assert.strictEqual(name, 'user-42');
  });

  it('rejects for an invalid id', async () => {
    await assert.rejects(() => fetchUserName(-1), /invalid id/);
  });
});
```

```js
// Mocking a dependency function and controlling timers with node:test's mock support
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const notifier = {
  send(message) {
    console.log('real send:', message);
  }
};

function scheduleReminder(delayMs, message) {
  setTimeout(() => notifier.send(message), delayMs);
}

test('scheduleReminder calls notifier.send after the delay', (t) => {
  const sendMock = t.mock.method(notifier, 'send');
  t.mock.timers.enable({ apis: ['setTimeout'] });

  scheduleReminder(5000, 'reminder!');
  assert.strictEqual(sendMock.mock.callCount(), 0); // not called yet

  t.mock.timers.tick(5000); // fast-forward without a real delay
  assert.strictEqual(sendMock.mock.callCount(), 1);
  assert.deepStrictEqual(sendMock.mock.calls[0].arguments, ['reminder!']);
});
```

```js
// Running with coverage: `node --test --experimental-test-coverage`
// This file intentionally has a branch that a naive test suite might miss.
import { test } from 'node:test';
import assert from 'node:assert/strict';

export function classify(n) {
  if (n < 0) return 'negative';
  if (n === 0) return 'zero';
  return 'positive';
}

test('classify covers all branches', () => {
  assert.strictEqual(classify(-5), 'negative');
  assert.strictEqual(classify(0), 'zero');
  assert.strictEqual(classify(5), 'positive');
  // Omitting any one of these three assertions would show up as a coverage gap.
});
```

## Common Pitfalls / Gotchas

- Forgetting to `await` async assertions like `assert.rejects`/`assert.doesNotReject` — without `await`, the test can pass "successfully" before the assertion actually runs.
- Using `assert.equal` (loose, `==`-based) instead of `assert.strictEqual`/the `node:assert/strict` module — loose equality can mask real bugs by coercing types during comparison.
- Not resetting or restoring mocks between tests (`mock.reset()` / `mock.restoreAll()`), causing state or call counts to leak between unrelated test cases and producing flaky results depending on execution order.
- Writing tests that depend on real wall-clock delays (`setTimeout` in a test without timer mocking) — this makes the suite slow and can introduce flakiness under CI load; use timer mocking instead.
- Chasing 100% code coverage as a goal in itself — coverage tells you what code *ran*, not whether the assertions actually verified correct behavior; it's necessary but not sufficient for confidence.
- Testing implementation details (private internal function calls, exact call order that doesn't affect behavior) instead of observable behavior, which makes tests brittle and breaks on harmless refactors.
- Mixing `node:test` and a userland framework like Jest in the same project without a clear reason — they have different globals, config, and CLI invocation, which complicates tooling and CI setup.
- Not isolating tests from shared external state (a real database, real filesystem paths, shared module-level mutable state) — this causes order-dependent test failures that are hard to reproduce locally.

## Interview Questions & Answers

**Q: What is `node:test`, and how does it compare to Jest or Mocha?**
A: `node:test` is Node's built-in test runner (stable since Node 20), providing `describe`/`it`/`test`, lifecycle hooks, async test support, and mocking, paired with `node:assert` for assertions — all with zero external dependencies, run via `node --test`. Jest is a more feature-rich all-in-one framework (assertions, mocking, snapshot testing, coverage, extensive ecosystem/IDE support) but is an external dependency with its own versioning. Mocha is a flexible runner that's typically paired with separate assertion (Chai) and mocking (Sinon) libraries. The choice is largely about tradeoffs between zero-dependency simplicity (`node:test`) versus richer built-in tooling and ecosystem maturity (Jest/Vitest).

**Q: How do you mock a function's dependency in `node:test`?**
A: Using `t.mock.fn()` to create a standalone mock function, or `t.mock.method(object, 'methodName')` to replace a method on an existing object with a tracked mock (recording call count and arguments while optionally preserving or overriding the original implementation). Mocks created via the per-test `t.mock` context are automatically restored after the test completes.

**Q: How would you avoid real delays in a test that depends on `setTimeout`?**
A: Use `node:test`'s built-in timer mocking (`t.mock.timers.enable()` and `t.mock.timers.tick(ms)`) to advance fake time synchronously and trigger scheduled callbacks immediately, instead of waiting for real wall-clock time to pass. This is the same concept as Jest's `jest.useFakeTimers()`/`jest.advanceTimersByTime()` or Sinon's fake timers.

**Q: Why is 100% code coverage not the same as a well-tested codebase?**
A: Coverage measures which lines/branches were *executed* during the test run, not whether the test actually asserted correct behavior for that code — a test could call a function and check nothing about its result, hitting 100% coverage of that function while verifying zero correctness. Coverage is useful for finding code paths with no tests at all, but it's a floor, not a substitute for meaningful assertions covering edge cases and failure modes.

**Q: What's the difference between `assert.equal` and `assert.strictEqual` (or using `node:assert/strict`)?**
A: `assert.equal` uses loose (`==`) equality, which performs type coercion (e.g., `assert.equal(1, '1')` passes). `assert.strictEqual` uses strict (`===`) equality with no coercion. Importing from `node:assert/strict` (or calling `assert.strict.*`) makes the entire assertion module default to strict comparisons, which is generally preferred since it catches type-related bugs that loose equality would silently hide.

## Related Topics
- [error-handlings.md](./error-handlings.md)
- [package-json.md](./package-json.md)
- [debugger.md](./debugger.md)
- [child-process.md](./child-process.md)
- [event-loop.md](./event-loop.md)
