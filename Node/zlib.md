# Zlib

The `node:zlib` module provides bindings to the zlib and Brotli compression libraries, giving Node.js built-in support for gzip, deflate/inflate (raw and zlib-wrapped), and Brotli compression/decompression. It's used heavily for HTTP response compression (`Content-Encoding: gzip`/`br`), compressing files before writing them to disk or object storage, and reducing payload size for network transfer in general. Every algorithm is exposed in three forms: a synchronous function (`gzipSync`), an async callback function (`gzip`), and a `Transform` stream constructor (`createGzip`) that can be piped.

Gzip (`zlib.gzip`/`gunzip`) is the most widely supported compression format for HTTP and file compression — nearly every HTTP client and CDN understands `Content-Encoding: gzip`. Deflate (`zlib.deflate`/`inflate`) is the raw underlying algorithm gzip is built on; `deflateRaw`/`inflateRaw` skip the zlib header/checksum for a few bytes of savings when you control both ends. Brotli (`zlib.brotliCompress`/`brotliDecompress`), added in Node 11.7, generally achieves better compression ratios than gzip — especially at higher quality settings — at the cost of significantly higher CPU time to compress (decompression speed is comparable). Modern browsers and CDNs widely support `Content-Encoding: br`, making it the preferred choice for static assets served over HTTPS where compression can be precomputed.

Because zlib operations can be CPU-intensive, the async/stream APIs are strongly preferred over the sync versions in server code — `gzipSync` on a large payload will block the event loop for the duration of the compression. The stream-based transform API (`createGzip`, `createBrotliCompress`, etc.) is the idiomatic way to compress data flowing through a pipeline, since it can be piped directly between a file read stream, an HTTP response, or any other stream without buffering the whole payload in memory.

Brotli's async functions accept a `params` option (e.g., `zlib.constants.BROTLI_PARAM_QUALITY`) to tune the compression-level/speed tradeoff, similar to gzip's `level` option (0–9, where 9 is maximum compression but slowest). Choosing the right level is a real production tradeoff: level 9 on a busy server compressing large responses synchronously per-request can become a CPU bottleneck, which is why many teams precompute compressed static assets at build time rather than compressing on every request.

## Examples

```js
// Basic gzip compress/decompress using the Promise-friendly callback API
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

async function roundTrip() {
  const input = Buffer.from('a'.repeat(10000), 'utf8');
  const compressed = await gzipAsync(input, { level: 9 });
  console.log(`Compressed ${input.length} bytes to ${compressed.length} bytes`);

  const decompressed = await gunzipAsync(compressed);
  console.log('Round trip matches:', decompressed.equals(input));
}

roundTrip();
```

```js
// Stream-based compression pipeline: read a file, gzip it, write to disk
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

async function gzipFile(inputPath, outputPath) {
  await pipeline(
    createReadStream(inputPath),
    createGzip({ level: 6 }),
    createWriteStream(outputPath)
  );
  console.log(`Wrote ${outputPath}`);
}

gzipFile('./access.log', './access.log.gz').catch(console.error);
```

```js
// HTTP server that compresses responses with Brotli when the client supports it
import { createServer } from 'node:http';
import { createBrotliCompress, createGzip, constants } from 'node:zlib';

const payload = JSON.stringify({ items: Array.from({ length: 1000 }, (_, i) => ({ id: i })) });

createServer((req, res) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';

  if (acceptEncoding.includes('br')) {
    res.writeHead(200, { 'Content-Encoding': 'br', 'Content-Type': 'application/json' });
    const brotli = createBrotliCompress({
      params: { [constants.BROTLI_PARAM_QUALITY]: 5 } // lower quality = faster, larger output
    });
    brotli.pipe(res);
    brotli.end(payload);
  } else if (acceptEncoding.includes('gzip')) {
    res.writeHead(200, { 'Content-Encoding': 'gzip', 'Content-Type': 'application/json' });
    const gzip = createGzip();
    gzip.pipe(res);
    gzip.end(payload);
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(payload);
  }
}).listen(3000);
```

## Common Pitfalls / Gotchas

- Using `gzipSync`/`brotliCompressSync` in a request handler — compression is CPU-bound and blocks the event loop; use the async or stream API in server code.
- Setting Brotli quality/gzip level to maximum (11 / 9) for every request — the compression ratio gains are often small compared to the large increase in CPU time; for dynamic per-request content, a mid-level setting is usually the better tradeoff.
- Forgetting to set the `Content-Encoding` response header when manually compressing HTTP responses — clients won't know to decompress the body.
- Mixing up `deflate` (zlib-wrapped) and `deflateRaw` (headerless) between producer and consumer — decompression will fail if the two sides don't agree on the format.
- Not handling decompression errors — corrupted or truncated compressed input throws/emits an error that must be caught, especially when compressed data comes from an untrusted network source.
- Recompressing already-compressed data (e.g., gzip-compressing a JPEG or a `.zip`) — it wastes CPU for negligible or even negative size savings.
- Not precomputing compression for static assets (build-time gzip/brotli of JS/CSS bundles) and instead compressing them on every request.

## Interview Questions & Answers

**Q: What's the difference between gzip, deflate, and Brotli in `node:zlib`?**
A: Deflate is the underlying compression algorithm; gzip wraps deflate output with a header and CRC32 checksum and is the most universally supported format for HTTP and file compression. Brotli is a newer, generally more efficient algorithm (better compression ratio, especially at high quality settings) that's now widely supported by browsers and CDNs via `Content-Encoding: br`, but it's more CPU-expensive to compress at high quality than gzip.

**Q: Why would you use `zlib.createGzip()` instead of `zlib.gzip()`?**
A: `createGzip()` returns a `Transform` stream, which lets you pipe data through compression without buffering the entire payload in memory — essential for large files or long-lived HTTP responses. `zlib.gzip()` (and its sync counterpart) operates on a complete in-memory buffer, requiring the whole input to be available and held in memory at once.

**Q: Why shouldn't you use `zlib.gzipSync` in an HTTP server's request handler?**
A: Compression is CPU-intensive, and the synchronous zlib functions run on the main thread, blocking the event loop for the duration of the call. Under load, this serializes all compression work and stalls every other request being handled concurrently. The async callback or stream API offloads the work via libuv's thread pool (or in chunks, for streams) without blocking the main thread.

**Q: How does a server decide whether to send gzip or Brotli to a client?**
A: By inspecting the `Accept-Encoding` request header, which lists the encodings the client supports (e.g., `gzip, deflate, br`), and choosing accordingly — typically preferring Brotli if present since it usually compresses better, falling back to gzip, and falling back to uncompressed if neither is supported. The response must then set the matching `Content-Encoding` header.

**Q: What's the tradeoff between compression level and CPU usage?**
A: Both gzip (`level`, 0–9) and Brotli (`BROTLI_PARAM_QUALITY`, 0–11) let you trade compression ratio for CPU time. Higher levels squeeze out more size reduction but take substantially more CPU, with diminishing returns near the top. For dynamic, per-request compression on a busy server, a moderate level balances CPU cost against payload size; for static assets that are compressed once and served many times, maximum compression at build time is usually worth it.

## Related Topics
- [streams.md](./streams.md)
- [http.md](./http.md)
- [https.md](./https.md)
- [file-systems.md](./file-systems.md)
- [buffers.md](./buffers.md)
- [util.md](./util.md)
