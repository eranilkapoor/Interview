# Error Handling

Node.js has two distinct error-propagation conventions layered on top of each other historically: the original "error-first callback" pattern (`callback(err, result)`), where the first argument is either `null`/`undefined` on success or an `Error` on failure, and the modern `Promise`/`async`-`await` pattern, where errors propagate via rejection and are caught with `try/catch` or `.catch()`. Understanding both matters because a lot of Node core APIs and older libraries still use callbacks, while virtually all new code is written with `async`/`await`.

With `async`/`await`, an error thrown (or a rejected Promise awaited) inside an `async` function propagates up exactly like a synchronous exception, and is caught with an ordinary `try/catch` around the `await`. A rejected Promise that is never awaited or `.catch()`-ed becomes an "unhandled rejection." Node distinguishes two categories of runtime errors at the process level: `process.on('uncaughtException', handler)` fires when a *synchronous* error escapes all try/catch blocks and would otherwise crash the process; `process.on('unhandledRejection', handler)` fires when a Promise rejects and nothing ever attached a rejection handler to it. Both are last-resort safety nets, not error-handling strategy — the Node documentation explicitly recommends treating an uncaught exception as a signal to log, clean up, and exit the process (since the app may now be in an inconsistent state), rather than trying to keep running.

A useful conceptual distinction, borrowed from Joyent's early Node error-handling guidance and still widely used, is operational errors vs programmer errors. Operational errors are expected failure conditions in a working system — a network request times out, a file doesn't exist, a database connection drops, user input fails validation. These should be anticipated, caught, and handled gracefully (retry, return a 4xx response, log and continue). Programmer errors are bugs — calling a function with the wrong argument type, a null-pointer-style access on `undefined`, a broken invariant. These shouldn't be "handled" by swallowing them; the correct response is usually to let the process crash (after logging) and fix the bug, because continuing to run in a known-broken state risks corrupting data or producing wrong results silently.

Custom `Error` subclasses (`class ValidationError extends Error`) let you attach structured metadata (an HTTP status code, an error code, a `cause`) and let calling code distinguish error types with `instanceof` or a `.code`/`.name` check, rather than parsing error message strings. `Error.captureStackTrace(targetObject, constructorOpt)` is a V8-specific API used inside custom error constructors to generate a clean stack trace that excludes the constructor's own frame, keeping stack traces focused on the actual call site rather than internal error-construction machinery. The `cause` option (`new Error('failed', { cause: originalError })`), standardized in ES2022, lets you wrap a lower-level error while preserving the original as context, instead of losing information by re-throwing a new unrelated error.

## Examples

```js
// Error-first callback convention vs async/await for the same operation
import { readFile } from 'node:fs';
import { readFile as readFileP } from 'node:fs/promises';

// Classic callback style
readFile('./config.json', 'utf8', (err, data) => {
  if (err) {
    console.error('Failed to read config:', err.message);
    return;
  }
  console.log(JSON.parse(data));
});

// Modern async/await style — equivalent error handling via try/catch
async function loadConfig() {
  try {
    const data = await readFileP('./config.json', 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load config:', err.message);
    throw err; // re-throw so the caller can decide how to respond
  }
}
```

```js
// Custom Error subclasses with structured metadata and a preserved cause
class ValidationError extends Error {
  constructor(message, { field } = {}) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
    Error.captureStackTrace(this, ValidationError); // exclude this constructor from the trace
  }
}

class DatabaseError extends Error {
  constructor(message, options) {
    super(message, options); // options.cause carries the original driver error
    this.name = 'DatabaseError';
    this.statusCode = 503;
  }
}

function validateUser(user) {
  if (!user.email) {
    throw new ValidationError('email is required', { field: 'email' });
  }
}

async function saveUser(user) {
  try {
    validateUser(user);
    // await db.insert(user);
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err; // operational error — caller (e.g. an HTTP handler) can return 400
    }
    throw new DatabaseError('failed to save user', { cause: err });
  }
}
```

```js
// Process-level last-resort handlers — log, clean up, and exit; don't try to "recover"
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception, shutting down:', err);
  // flush logs, close server connections, etc.
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// This forgotten .catch() would trigger 'unhandledRejection' above
async function riskyOperation() {
  throw new Error('boom');
}
riskyOperation(); // no await, no .catch() — rejection goes unhandled
```

## Common Pitfalls / Gotchas

- Forgetting to check the `err` argument in a callback (`callback((err, data) => { use(data); })` without checking `err` first) — this silently proceeds with `data` as `undefined`/garbage instead of surfacing the failure.
- Awaiting a Promise without a `try/catch`, or calling an `async` function without `await`/`.catch()` — both leave errors unhandled, the latter triggering `unhandledRejection`.
- Using `process.on('uncaughtException')` to "recover" and keep the process running after a synchronous error — the process may be in an inconsistent state (partially mutated data, leaked resources), so the recommended pattern is to log and exit, then rely on a process manager (PM2, Kubernetes, systemd) to restart cleanly.
- Treating every error the same way (catching broadly and returning a generic 500) instead of distinguishing operational errors (validation failures, timeouts — handle gracefully) from programmer errors (bugs — let them crash and get fixed).
- Swallowing errors silently (`catch (err) {}` with no logging or re-throw) — this destroys the ability to debug failures and can mask serious bugs.
- Losing the original error context by throwing a new, unrelated error in a `catch` block instead of using the `cause` option to chain them.
- Not setting `Error.captureStackTrace` in custom error constructors — without it, the stack trace includes the constructor's own frame, cluttering it with implementation-detail noise instead of the actual call site.
- Relying solely on `unhandledRejection` as a substitute for proper `try/catch` around awaited calls — by the time it fires, you've lost the specific context needed to handle the error meaningfully; it should be a safety net, not the primary handling mechanism.

## Interview Questions & Answers

**Q: What is the error-first callback convention in Node, and why was it designed that way?**
A: By convention, callback-based Node APIs invoke their callback with the error as the first argument (`null` on success) and the result as the second: `callback(err, result)`. This forces every callback consumer to at least acknowledge the possibility of an error (by checking `err`) before using `result`, since JavaScript has no compiler-enforced exception handling for callbacks the way `try/catch` enforces it for synchronous/`async` code.

**Q: What's the difference between `process.on('uncaughtException')` and `process.on('unhandledRejection')`?**
A: `uncaughtException` fires when a synchronous error is thrown and no `try/catch` anywhere in the call stack catches it, which would otherwise crash the process immediately. `unhandledRejection` fires when a Promise rejects and no `.catch()` or `try/catch` (via `await`) is ever attached to handle that rejection. Both are meant as last-resort logging/cleanup hooks before intentionally exiting — not as a general error-handling strategy.

**Q: What's the difference between an operational error and a programmer error, and why does the distinction matter?**
A: Operational errors are expected, recoverable failure conditions in a correctly-written program — a failed network call, invalid user input, a timeout. They should be caught and handled gracefully. Programmer errors are actual bugs — type errors, broken invariants, calling something incorrectly — and trying to "handle" them by catching and continuing risks running in a corrupted, unpredictable state. The distinction determines the right response: handle and continue for the former, log and crash (then fix the bug) for the latter.

**Q: Why would you create custom `Error` subclasses instead of just throwing `new Error('message')` everywhere?**
A: Custom subclasses let calling code programmatically distinguish error types (via `instanceof` or a `.code`) instead of parsing message strings, and let you attach structured, error-specific metadata — an HTTP status code, a validation field name, a retryable flag — that generic `Error` objects don't have. This makes centralized error-handling logic (e.g., an Express error middleware that maps error types to HTTP responses) much cleaner and more reliable.

**Q: What does the `cause` option on `Error` do, and why use it?**
A: `new Error('higher-level message', { cause: originalError })` lets you wrap a lower-level error in a more contextual one while preserving the original as `.cause`, rather than discarding it. This is useful when catching a low-level error (e.g., a database driver error) and re-throwing a more meaningful domain error, without losing the original stack trace/details needed for debugging.

## Related Topics
- [unit-tests.md](./unit-tests.md)
- [event-loop.md](./event-loop.md)
- [process-and-os.md](./process-and-os.md)
- [express-routing-middleware-error-handling.md](./express-routing-middleware-error-handling.md)
- [debugger.md](./debugger.md)
