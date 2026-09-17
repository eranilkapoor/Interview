# Util

The `node:util` module is a grab-bag of internal-facing helper functions that Node itself uses and also exposes publicly, because they solve problems that come up constantly when writing Node code: bridging the callback and Promise worlds, formatting values for debug output, marking APIs as deprecated, and runtime type-checking beyond what `typeof`/`instanceof` can tell you. It's not a themed module like `fs` or `crypto` — it's utility glue.

`util.promisify(fn)` is the standard way to convert a Node-style callback function (one whose last argument is `(err, result) => {}`) into a function that returns a Promise, so it can be used with `async`/`await`. It works by convention: it assumes the wrapped function's last parameter is an error-first callback and that the callback is called with at most one non-error result. Node core functions like `fs.readFile` already have Promise-native equivalents (`fs.promises`), but `promisify` is essential for third-party or legacy callback-based APIs that don't. `util.callbackify` does the reverse — turning an `async` function into one that takes a Node-style callback — useful when you need to hand a Promise-based function to older code expecting callbacks.

`util.inspect(obj, options)` converts any JavaScript value into a human-readable string representation, and it's what `console.log` uses internally to print objects. It supports options like `depth` (how many levels of nested objects to expand), `colors` (ANSI color output for terminals), and `showHidden` (include non-enumerable properties). Custom classes can define a `[util.inspect.custom]` symbol method to control how their instances are printed in debug output, which is useful for classes wrapping sensitive data (so secrets don't leak into logs) or ones with large internal state that would otherwise flood the console.

`util.types` provides reliable low-level type checks (`isPromise`, `isRegExp`, `isMap`, `isAsyncFunction`, etc.) that work correctly across realms/contexts (e.g., objects created in a different `vm` context or `worker_thread`), where `instanceof` checks can incorrectly fail because the object's prototype chain points to a different realm's constructor. `util.deprecate(fn, message)` wraps a function so that calling it emits a one-time deprecation warning, which is how Node itself marks its own APIs (like `url.parse`) as deprecated without immediately removing them, and is a useful pattern for library authors doing the same.

## Examples

```js
// promisify: turning a callback-based API into an async/await-friendly one
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);

async function listFiles() {
  const { stdout, stderr } = await execAsync('dir', { shell: true });
  if (stderr) console.error(stderr);
  console.log(stdout);
}

listFiles().catch(console.error);
```

```js
// util.inspect for controlled debug output, including a custom formatter
import { inspect } from 'node:util';

class ApiToken {
  constructor(value) {
    this.value = value;
  }
  [inspect.custom]() {
    return `ApiToken(${this.value.slice(0, 4)}****)`; // never print the full secret
  }
}

const nested = { user: { id: 1, roles: ['admin', 'billing'] }, token: new ApiToken('sk_live_abcdef123456') };

console.log(inspect(nested, { depth: null, colors: true }));
// { user: { id: 1, roles: [ 'admin', 'billing' ] }, token: ApiToken(sk_l****) }
```

```js
// util.types for reliable type checks, and util.deprecate for marking old APIs
import { types, deprecate } from 'node:util';

console.log(types.isPromise(Promise.resolve()));       // true
console.log(types.isAsyncFunction(async () => {}));    // true
console.log(types.isRegExp(/abc/));                     // true

const oldConfig = deprecate(
  (key) => process.env[key],
  'oldConfig() is deprecated, use config.get() instead',
  'DEP0001'
);

oldConfig('PORT'); // logs a one-time deprecation warning to stderr, then behaves normally
```

## Common Pitfalls / Gotchas

- Applying `promisify` to a function that doesn't follow the error-first callback convention (e.g., callback called with multiple results, or error not first) — the resulting Promise wrapper will behave incorrectly or silently drop data.
- Forgetting that `promisify` only captures the *second* callback argument onward as the resolved value if there are multiple — for multi-value callbacks, you often need `util.promisify.custom` or a manual wrapper.
- Relying on `console.log`'s default object formatting for large/deeply nested structures in production logs — it truncates at `depth: 2` by default, silently hiding nested data unless you use `util.inspect` with `depth: null` explicitly.
- Using `instanceof` to type-check values that might come from a different Node `vm` context, `worker_thread`, or iframe-like realm — it can give false negatives; `util.types` checks are realm-safe.
- Leaking sensitive data (tokens, passwords, PII) into logs because a class doesn't define `[util.inspect.custom]`, so its full internal state gets printed by `console.log`.
- Using `util.deprecate` but never actually planning a removal — it's meant to be a transitional warning, not a permanent no-op wrapper.
- Assuming `util.promisify(setTimeout)` works out of the box for timing — Node's `timers/promises` module already provides `setTimeout` as a Promise natively; reinventing it with `promisify` is unnecessary in modern code.

## Interview Questions & Answers

**Q: What does `util.promisify` do, and what does it assume about the function it wraps?**
A: It takes a function that follows Node's error-first callback convention — `fn(...args, (err, result) => {})` — and returns a new function that, when called with the same leading arguments, returns a Promise that rejects with `err` or resolves with `result`. It assumes the callback is the last parameter and is invoked with at most one success value; functions that don't follow this convention need a manual wrapper instead.

**Q: How does `util.inspect` relate to `console.log`?**
A: `console.log` uses `util.inspect` internally to stringify non-string arguments (objects, arrays, errors) before printing them. That's why passing an object to `console.log` shows a formatted, colorized representation rather than `[object Object]` — and why options like inspection depth and custom `[util.inspect.custom]` formatters affect what `console.log` prints too.

**Q: Why would you use `util.types.isPromise()` instead of `value instanceof Promise`?**
A: `instanceof` checks the prototype chain against the `Promise` constructor in the *current* realm. If the value was created in a different execution context — a different `vm.Context`, a different `worker_thread`, or an iframe in a browser — its prototype chain points to a different realm's `Promise`, so `instanceof` returns `false` even though the value genuinely is a promise. `util.types.isPromise` uses internal engine slots to check this correctly regardless of which realm created the value.

**Q: What's the difference between `util.promisify` and `util.callbackify`?**
A: They're inverses. `promisify` converts a callback-style function into one returning a Promise, for use with `async`/`await`. `callbackify` converts an `async` function (or any function returning a Promise) into one that accepts a Node-style error-first callback as its last argument — useful when integrating modern Promise-based code into an older codebase or library API that expects callbacks.

**Q: How would you prevent sensitive fields from appearing in debug logs when an object is printed with `console.log`?**
A: Define a `[util.inspect.custom]` method on the class (or a `toJSON`/`inspect` convention depending on context) that returns a redacted or masked string representation instead of the default enumeration of all own properties. This ensures that any code path that logs the object — directly or nested inside another logged object — never exposes the raw sensitive value.

## Related Topics
- [console.md](./console.md)
- [error-handlings.md](./error-handlings.md)
- [process-and-os.md](./process-and-os.md)
- [worker_threads.md](./worker_threads.md)
- [vm.md](./vm.md)
