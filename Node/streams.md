# Streams

Streams are Node's abstraction for working with data that's read or written incrementally rather than all at once — chunk by chunk — instead of being fully loaded into memory before processing begins. This is essential for handling large files, network sockets, and any data source whose full size is unknown or too large to buffer entirely, and it's a pattern that shows up throughout Node core: `http.IncomingMessage` and `http.ServerResponse` are streams, `fs.createReadStream`/`createWriteStream` are streams, TCP sockets from `net` are streams, and `zlib`/`crypto` transformation APIs expose stream interfaces too. The `node:stream` module defines the base classes underlying all of this.

There are four fundamental stream types. A **Readable** stream is a source of data you consume (e.g., `fs.createReadStream`) — it emits `'data'` events (flowing mode) or you pull from it with `.read()` (paused mode), and emits `'end'` when exhausted. A **Writable** stream is a destination you push data into via `.write()` (e.g., `fs.createWriteStream`, an HTTP response), finished with `.end()`. A **Duplex** stream is both readable and writable, with independent internal read and write sides (e.g., a TCP socket — you can read what the other end sent while writing your own data). A **Transform** stream is a special Duplex where the writable side's input is processed and produces the readable side's output (e.g., `zlib.createGzip()`, `crypto.createCipheriv()` — data goes in one end, transformed data comes out the other).

**Backpressure** is the mechanism that keeps a fast producer from overwhelming a slow consumer. When you call `writable.write(chunk)`, it returns `false` if the internal buffer has exceeded `highWaterMark` — the signal to stop writing more until the stream emits a `'drain'` event, at which point it's safe to resume. Manually managing this correctly (pause reading, wait for drain, resume) is error-prone, which is why `readable.pipe(writable)` exists — it automatically handles backpressure by pausing the source when the destination signals it's full and resuming when it drains. The modern preferred API is `stream.pipeline()` (from `node:stream/promises` for an awaitable version, or callback-based from `node:stream`), which does what `pipe()` does but also properly propagates errors and cleans up all streams involved if any one of them fails — a scenario `pipe()` alone handles poorly (errors don't auto-propagate through a `pipe()` chain, leaving other streams open/leaking).

Streams can operate in **object mode**, where instead of Buffers/strings, arbitrary JavaScript objects flow through — useful for building data-processing pipelines (e.g., parsing CSV rows into objects, then transforming, then writing to a database) using the same backpressure-aware plumbing rather than manually buffering arrays of objects in memory.

## Examples

```js
// Real backpressure-aware file copy with pipeline (stream/promises)
const { pipeline } = require('node:stream/promises');
const fs = require('node:fs');
const zlib = require('node:zlib');

async function compressFile(inputPath, outputPath) {
  await pipeline(
    fs.createReadStream(inputPath),
    zlib.createGzip(),
    fs.createWriteStream(outputPath)
  );
  console.log('compression complete:', outputPath);
}

compressFile('./access.log', './access.log.gz').catch((err) => {
  console.error('pipeline failed:', err.message); // errors from any stage propagate here
});
```

```js
// A custom Transform stream: uppercase each chunk of text flowing through
const { Transform, pipeline } = require('node:stream');

class UppercaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback(); // signals this chunk is processed; required for backpressure to work
  }
}

process.stdin
  .pipe(new UppercaseTransform())
  .pipe(process.stdout);
// Try: echo "hello world" | node this-script.js  -> HELLO WORLD
```

```js
// Manually handling backpressure without pipe(), to show what write()/drain do
const fs = require('node:fs');

function writeLotsOfData(writable, totalChunks) {
  let i = 0;
  function write() {
    let ok = true;
    while (i < totalChunks && ok) {
      const chunk = Buffer.from(`line ${i}\n`);
      i++;
      if (i === totalChunks) {
        writable.end(chunk); // last chunk
      } else {
        ok = writable.write(chunk); // false means internal buffer is full
      }
    }
    if (i < totalChunks) {
      // Wait for 'drain' before writing more instead of ignoring the signal
      writable.once('drain', write);
    }
  }
  write();
}

const out = fs.createWriteStream('./output.txt');
writeLotsOfData(out, 100000);
out.on('finish', () => console.log('all writes flushed to disk'));
```

## Common Pitfalls / Gotchas

- Using `.pipe()` without handling errors — errors on the source or destination stream don't automatically propagate through the pipe chain, so a failed read can leave a write stream open and leaking file descriptors; prefer `stream.pipeline()` which handles this correctly.
- Ignoring the return value of `writable.write()` — if it returns `false` and you keep calling `.write()` anyway, you defeat backpressure and can balloon memory usage buffering unsent data.
- Forgetting to call the `callback` (or calling it twice) inside a custom `_transform`/`_write` implementation — this stalls the stream or corrupts internal state.
- Loading an entire large file into memory with `fs.readFile` when a `createReadStream` + pipeline approach would process it incrementally with bounded memory.
- Mixing flowing mode (`'data'` event / `.pipe()`) and paused mode (`.read()`) on the same Readable inconsistently, which leads to confusing dropped or duplicated data.
- Not setting/considering `highWaterMark` for use cases with very large or very small chunks — the default (16KB for byte streams, 16 objects for object mode) isn't always appropriate.
- Assuming object-mode streams behave identically to byte streams regarding `highWaterMark` — in object mode it counts number of objects, not bytes.

## Interview Questions & Answers

**Q: What are the four fundamental stream types in Node and how do they differ?**
A: Readable (a source you consume, like `fs.createReadStream`), Writable (a destination you write to, like an HTTP response), Duplex (both readable and writable with independent sides, like a TCP socket), and Transform (a Duplex where writable input is transformed into readable output, like `zlib.createGzip()`).

**Q: What is backpressure, and how does `pipe()` handle it automatically?**
A: Backpressure is the situation where a Writable can't accept data as fast as a Readable is producing it. `writable.write()` returns `false` when its internal buffer exceeds `highWaterMark`, signaling the producer to pause. `.pipe()` listens for that signal, automatically calls `.pause()` on the source, and resumes it once the destination emits `'drain'` — so you get correct flow control without manual bookkeeping.

**Q: Why is `stream.pipeline()` generally preferred over chaining `.pipe()` calls manually?**
A: `pipeline()` (or its promise-based `stream/promises` version) properly forwards errors from any stream in the chain to a single callback/rejected promise, and ensures all streams involved are properly destroyed/cleaned up if any one of them errors or the pipeline is aborted. Manual `.pipe()` chains don't propagate errors between streams, which can leave file descriptors or sockets open after a failure.

**Q: What does "object mode" mean for a stream?**
A: Instead of passing Buffers or strings, the stream passes arbitrary JavaScript values (e.g., parsed objects) through its `_read`/`_write`/`_transform` implementations. You enable it with `{ objectMode: true }`. It's used to build multi-stage data-processing pipelines (parse -> transform -> load) that still benefit from streaming backpressure, just measured in "number of objects" rather than bytes for `highWaterMark`.

**Q: How would you copy a very large file without loading it entirely into memory?**
A: Use `fs.createReadStream(src)` piped through `fs.createWriteStream(dest)` via `stream.pipeline()` (or `stream/promises`'s `pipeline`), which streams the file in `highWaterMark`-sized chunks and respects backpressure, keeping memory usage bounded regardless of file size — as opposed to `fs.readFile`/`fs.writeFile`, which load the whole file into a Buffer first.

## Related Topics

- [buffers.md](./buffers.md)
- [http.md](./http.md)
- [event-loop.md](./event-loop.md)
- [file-systems.md](./file-systems.md)
- [non-blocking.md](./non-blocking.md)
