# Console

Node's global `console` object is an instance of the `Console` class from the `node:console` module, pre-configured to write to `process.stdout` (for `log`/`info`/`debug`/`table`/etc.) and `process.stderr` (for `error`/`warn`/`trace`). It's modeled after the browser console API for familiarity, but Node's implementation is backed by real writable streams rather than a devtools panel, which is why you can also construct your own `Console` instances pointed at arbitrary streams — files, sockets, in-memory buffers — for custom logging destinations.

`console.log`/`info`/`debug` write to stdout; `console.error`/`warn` write to stderr — this split matters operationally, because shells and process managers let you redirect the two streams independently (`node app.js 1>out.log 2>err.log`), and log aggregation/monitoring pipelines often treat stderr output as signal for alerting. Beyond basic logging, `console` has several under-used methods: `console.table` renders array/object data as an ASCII table (handy for quick debug inspection of structured data), `console.group`/`groupEnd` indent subsequent output for visually nesting related log lines, and `console.time(label)`/`console.timeEnd(label)` measure elapsed wall-clock time between two calls — a lightweight alternative to manually diffing `Date.now()` or `performance.now()` calls for ad hoc profiling.

Internally, `console.log(obj)` formats non-string arguments using `util.inspect`, which is why objects print as their structured representation (with configurable depth, and respecting a class's `[util.inspect.custom]` method) rather than `[object Object]`. `console.log` also supports `printf`-style format specifiers (`%s`, `%d`, `%j`, `%o`, `%O`) when the first argument is a string containing them.

The key architectural distinction from `process.stdout.write` is that `console.log` adds a trailing newline and does the `util.inspect` formatting/interpolation automatically, while `process.stdout.write` is a raw stream write that takes only strings/buffers and does no formatting — you'd reach for `process.stdout.write` when you need precise control over output (no auto-newline, e.g. a progress bar that rewrites the same line) or maximum throughput without formatting overhead. In production services, raw `console.*` calls are usually replaced by a structured logging library (pino, winston) that outputs JSON lines to stdout for log aggregators to parse, but understanding the underlying `Console`/stream relationship is what makes those libraries make sense.

## Examples

```js
// Core console methods beyond console.log
console.table([
  { id: 1, name: 'Anil', role: 'admin' },
  { id: 2, name: 'Priya', role: 'user' }
]);

console.group('Startup sequence');
console.log('Loading config...');
console.log('Connecting to database...');
console.groupEnd();

console.time('db-query');
// ... simulate work
for (let i = 0; i < 1e6; i++) {}
console.timeEnd('db-query'); // "db-query: 4.201ms"

console.error('This goes to stderr, not stdout');
```

```js
// Creating a custom Console instance that writes to a log file instead of the terminal
import { Console } from 'node:console';
import { createWriteStream } from 'node:fs';

const logStream = createWriteStream('./app.log', { flags: 'a' });
const errStream = createWriteStream('./app-error.log', { flags: 'a' });
const fileLogger = new Console({ stdout: logStream, stderr: errStream });

fileLogger.log('Server started on port %d at %s', 3000, new Date().toISOString());
fileLogger.error('Failed to connect to cache: %s', 'ECONNREFUSED');
```

```js
// console.log vs process.stdout.write: formatting/newline behavior
console.log('user:', { id: 1, active: true }); // auto-formats the object, adds newline

process.stdout.write('Progress: 0%');
for (let pct = 10; pct <= 100; pct += 10) {
  process.stdout.write(`\rProgress: ${pct}%`); // no auto newline, so \r can overwrite the line
}
process.stdout.write('\n');
```

## Common Pitfalls / Gotchas

- Assuming `console.log` is synchronous and cheap everywhere — when stdout is piped to a file or another process (not a TTY), writes on POSIX can be synchronous and block; on Windows, and for pipes generally, behavior varies, so extremely high-frequency logging can become a real bottleneck.
- Logging large objects/arrays in production without limiting depth — `console.log`'s default `util.inspect` depth truncates nested structures, silently hiding data you may have needed, while flat but huge arrays can flood log output.
- Mixing `console.log` for both normal output and error output instead of using `console.error`/`warn` for the latter — this breaks the stdout/stderr separation that shell redirection and log-level filtering depend on.
- Leaving verbose `console.log` debug statements in production code paths — they add overhead and clutter aggregated logs; use a logging library with configurable log levels instead.
- Forgetting that `console.table`, `console.group`, and colorized output are meant for human-readable terminal debugging, not for structured logs consumed by log aggregators (which generally want JSON lines).
- Assuming a custom `Console` instance automatically gets the same formatting niceties (colors, inspect options) as the global one without configuring them — they need to be passed explicitly via the `Console` constructor's options.
- Using `console.time`/`timeEnd` with the same label concurrently in overlapping async operations — labels are global to the console instance, so concurrent timers with the same label will collide and produce incorrect results.

## Interview Questions & Answers

**Q: What's the difference between `console.log` and `process.stdout.write`?**
A: `console.log` accepts multiple arguments, formats non-string values via `util.inspect`, supports `printf`-style format specifiers, and appends a trailing newline automatically. `process.stdout.write` is the lower-level, raw stream write — it only accepts a string or Buffer, does no formatting, and does not add a newline. `console.log` is implemented on top of `process.stdout.write` (and `util.inspect`/`util.format`).

**Q: Why does it matter that `console.error` writes to stderr instead of stdout?**
A: Because stdout and stderr are independent streams, shells and process supervisors can redirect them separately (`cmd 1>out.log 2>err.log`), and log pipelines/monitoring tools often specifically watch stderr as a signal for errors/alerts. Writing error output to stdout via `console.log` would mix it in with normal output and break that separation, making it harder to filter or alert on failures.

**Q: How would you create a logger that writes to a file instead of the terminal, using only Node core?**
A: Import the `Console` class from `node:console` and construct a new instance, passing writable streams (e.g., from `fs.createWriteStream`) as the `stdout`/`stderr` options: `new Console({ stdout: fileStream, stderr: errFileStream })`. The resulting object has the same API (`log`, `error`, `table`, etc.) as the global console, but writes to the given streams instead of the terminal.

**Q: What does `console.log` use internally to format objects, and why does that matter?**
A: It uses `util.inspect` to convert non-string arguments into readable string representations. This matters because `util.inspect`'s options (like default recursion depth) determine what actually gets printed — deeply nested objects get truncated by default — and because a class can customize its own log output by implementing `[util.inspect.custom]`, which is useful for hiding sensitive fields from logs.

**Q: Why would production services typically avoid raw `console.log` calls in favor of a logging library?**
A: Raw `console.log` gives you no log levels, no structured (machine-parseable) output, no built-in correlation IDs/context, and no control over destinations (multiple sinks, log rotation, sampling). Logging libraries like pino or winston output structured JSON lines suited for aggregators (e.g., ELK, Datadog), support configurable log levels so verbosity can be tuned per environment without code changes, and are typically far more performant under high log volume than naive `console.log`.

## Related Topics
- [util.md](./util.md)
- [process-and-os.md](./process-and-os.md)
- [tty.md](./tty.md)
- [streams.md](./streams.md)
- [debugger.md](./debugger.md)
