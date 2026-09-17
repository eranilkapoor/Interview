# File Systems

The `node:fs` module is Node's binding to the underlying operating system's file system calls (libuv on the backend), and it exposes the same operations in four different styles: synchronous (`fs.readFileSync`), callback-based (`fs.readFile`), Promise-based (`fs.promises.readFile` / `require('node:fs/promises')`), and stream-based (`fs.createReadStream`). All of them ultimately call into libuv's thread pool for the actual disk I/O (except a handful of syscalls that are effectively synchronous at the OS level), so "async" fs calls do not block the event loop, but they do consume a slot in the libuv thread pool (default size 4, configurable via `UV_THREADPOOL_SIZE`).

The synchronous variants (`readFileSync`, `writeFileSync`, `mkdirSync`, `statSync`, etc.) run entirely on the main thread and block the event loop until the OS call returns. They're fine for one-off scripts, CLI tools, or startup-time config loading, but using them inside a request handler in a server will stall every other in-flight request. The callback API is the original Node style and follows the error-first callback convention (`(err, data) => {}`). The Promise API, available as `fs.promises` or via `import * as fs from 'node:fs/promises'`, is the recommended modern style for anything using `async`/`await`, since it avoids callback nesting and integrates with `try/catch`.

For large files, reading the whole file into memory with `readFile`/`readFileSync` is wasteful and can hit memory limits. `fs.createReadStream` and `fs.createWriteStream` process data in chunks as a `Readable`/`Writable` stream, which can be piped directly to/from other streams (HTTP responses, gzip transforms, sockets) with backpressure handled automatically. This is the standard pattern for serving large files, processing logs, or transforming data without loading it entirely into memory.

`fs.watch` provides OS-level file/directory change notifications (inotify on Linux, FSEvents on macOS, ReadDirectoryChangesW on Windows), but its behavior is notoriously platform-inconsistent — event names (`rename` vs `change`), whether it's recursive, and reliability over network file systems all vary. `fs.watchFile` is a polling-based alternative that's more portable but less efficient and has higher latency. Most tooling (nodemon, webpack, chokidar) wraps these low-level APIs with fallback/debouncing logic to smooth out the platform differences.

## Examples

```js
// Promise-based API — the recommended modern style
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';

async function main() {
  await mkdir('./data', { recursive: true });
  await writeFile('./data/config.json', JSON.stringify({ env: 'prod' }, null, 2));

  const raw = await readFile('./data/config.json', 'utf8');
  console.log(JSON.parse(raw));

  const entries = await readdir('./data', { withFileTypes: true });
  for (const entry of entries) {
    const info = await stat(`./data/${entry.name}`);
    console.log(entry.name, entry.isDirectory() ? 'dir' : 'file', info.size, 'bytes');
  }
}

main().catch(console.error);
```

```js
// Streaming a large file instead of loading it into memory,
// with backpressure handled automatically by pipeline()
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

async function compressLogFile(src, dest) {
  await pipeline(
    createReadStream(src),
    createGzip(),
    createWriteStream(dest)
  );
  console.log(`${src} compressed to ${dest}`);
}

compressLogFile('./app.log', './app.log.gz').catch(console.error);
```

```js
// fs.watch for reacting to file changes (e.g. a lightweight config reloader)
import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';

let debounceTimer;
watch('./data/config.json', (eventType, filename) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    console.log(`Detected ${eventType} on ${filename}, reloading config...`);
    const raw = await readFile('./data/config.json', 'utf8');
    console.log('New config:', JSON.parse(raw));
  }, 100); // debounce because editors often fire multiple events per save
});
```

## Common Pitfalls / Gotchas

- Using `readFileSync`/`writeFileSync` inside request handlers on a server — this blocks the entire event loop for every concurrent request, not just the one that triggered it.
- Reading huge files entirely into memory with `readFile` instead of streaming them, causing memory spikes or crashes on large inputs.
- Ignoring backpressure when manually piping streams with `.on('data')` instead of using `.pipe()` or `stream/promises`' `pipeline()`, which can cause unbounded memory growth if the destination is slower than the source.
- Relying on `fs.watch`'s event names or recursive option being consistent across platforms — always test on the actual target OS, or use a battle-tested library like `chokidar` for production file watching.
- Forgetting that relative paths passed to `fs` functions are resolved relative to `process.cwd()`, not the location of the module file — use `path.join(__dirname, ...)` or `import.meta.url` for module-relative paths.
- Not handling `ENOENT`/`EEXIST`/`EACCES` errors distinctly — e.g. blindly calling `mkdir` without `{ recursive: true }` and crashing when the directory already exists.
- Leaving file descriptors open by using low-level `fs.open`/`fs.read`/`fs.close` without wrapping in `try/finally`, leaking descriptors over time.
- Assuming `fs.stat` follows symlinks the same way as `fs.lstat` — `stat` follows symlinks to the target, `lstat` reports on the link itself.

## Interview Questions & Answers

**Q: What's the difference between the synchronous, callback, and Promise APIs in `node:fs`, and when would you use each?**
A: All three ultimately perform the same OS-level I/O via libuv, but differ in how they integrate with the event loop. `readFileSync` blocks the calling thread until the operation completes — fine for CLI scripts or one-time startup work, dangerous in a server's hot path. The callback API (`fs.readFile`) is async and non-blocking but uses Node's classic error-first callback signature. The Promise API (`fs.promises` / `node:fs/promises`) is also non-blocking and is preferred in modern code because it composes cleanly with `async`/`await` and `try/catch`.

**Q: Why would you stream a file instead of using `fs.readFile`?**
A: `readFile` loads the entire file into memory before your code can act on it, which is wasteful and potentially crash-inducing for large files (e.g. multi-GB logs or video). `createReadStream` reads and emits data in bounded chunks, so memory usage stays roughly constant regardless of file size, and you can pipe those chunks directly into transforms (gzip, encryption) or destinations (HTTP response, another file) with backpressure handled for you.

**Q: What does backpressure mean in the context of `fs` streams, and how do you handle it correctly?**
A: Backpressure is what happens when a writable destination can't consume data as fast as a readable source produces it. If you ignore it (e.g., calling `write()` in a loop without checking its return value), buffered data accumulates in memory unboundedly. The correct approach is to use `.pipe()` or `stream.pipeline()`/`stream/promises`' `pipeline()`, which automatically pause the source when the destination signals it's full and resume it once drained.

**Q: Why is `fs.watch` considered unreliable, and what would you use instead in production?**
A: `fs.watch` is a thin wrapper over OS-native file notification APIs (inotify, FSEvents, ReadDirectoryChangesW), and those APIs differ in what events they report, whether `filename` is always populated, and how recursion is supported. This makes cross-platform behavior inconsistent. In production tooling, most people use `chokidar`, which normalizes these differences and adds debouncing and stability checks (waiting until a file stops changing before firing an event).

**Q: What's the difference between `fs.stat` and `fs.lstat`?**
A: `stat` resolves symbolic links and returns information about the file the link points to. `lstat` does not follow the link — it returns information about the symlink itself (e.g., that it is a symlink, its own size/permissions). You'd use `lstat` when you specifically need to detect or inspect symlinks rather than transparently follow them.

## Related Topics
- [streams.md](./streams.md)
- [zlib.md](./zlib.md)
- [error-handlings.md](./error-handlings.md)
- [event-loop.md](./event-loop.md)
- [blocking.md](./blocking.md)
- [process-and-os.md](./process-and-os.md)
