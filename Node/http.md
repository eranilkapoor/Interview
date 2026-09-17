# HTTP

The `node:http` module is Node's built-in implementation of the HTTP/1.1 protocol, providing both server and client capabilities without any external dependency. It's the foundation every higher-level web framework (Express, Fastify, Koa, NestJS's HTTP adapter) is ultimately built on top of — those frameworks add routing, middleware, and convenience APIs, but the underlying request/response handling, header parsing, and socket management all flow through `node:http`.

On the server side, `http.createServer((req, res) => { ... })` creates an `http.Server` instance; calling `.listen(port)` starts it accepting TCP connections. The callback receives an `IncomingMessage` (`req`) and a `ServerResponse` (`res`) for each request. Critically, both are streams: `req` is a **Readable** stream that emits the request body as `'data'` events/chunks (you must consume it manually or pipe it — `node:http` does not parse bodies for you, unlike Express's `express.json()` middleware), and `res` is a **Writable** stream you write the response body to via `.write()`/`.end()`, after setting `res.statusCode` and headers with `res.setHeader()` or `res.writeHead(statusCode, headers)`.

On the client side, `http.request(options, callback)` and the simpler `http.get(url, callback)` issue outbound HTTP requests. `http.request` returns a `ClientRequest` (itself a Writable stream, for sending a request body) and the callback receives an `IncomingMessage` representing the response (a Readable stream again). Modern code increasingly reaches for the global `fetch()` (stable in Node 18+, built on `undici`) for simple client calls, but `http.request`/`https.request` remain important for fine-grained control — custom agents, streaming large bodies, or low-level protocol needs.

Connection reuse is managed by `http.Agent`, which pools and reuses TCP sockets across requests to the same host (keep-alive), avoiding the overhead of a new TCP (and TLS, for HTTPS) handshake per request. The default global agent has `keepAlive: false` in older behavior contexts but connection-level `Connection: keep-alive` is standard HTTP/1.1 behavior on the server side by default; for outbound client requests, explicitly configuring `new http.Agent({ keepAlive: true })` and passing it as `options.agent` is a common production optimization for services making many requests to the same downstream host, since it avoids handshake latency and reduces ephemeral port/socket churn under load.

## Examples

```js
// A raw http server that manually reads the request body stream and responds
const http = require('node:http');

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/echo') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; }); // req is a Readable stream
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ received: body }));
    });
    req.on('error', (err) => {
      res.statusCode = 400;
      res.end('bad request');
    });
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});

server.listen(3000, () => console.log('listening on :3000'));
```

```js
// A client request with a reusable keep-alive Agent, plus timeout handling
const http = require('node:http');

const agent = new http.Agent({ keepAlive: true, maxSockets: 50 });

function fetchStatus(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 3000, path, method: 'GET', agent },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('request timed out')));
    req.end();
  });
}

fetchStatus('/health').then(console.log).catch(console.error);
```

```js
// Streaming a large file directly to the response instead of buffering it
const http = require('node:http');
const fs = require('node:fs');

http.createServer((req, res) => {
  if (req.url === '/download') {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="report.csv"',
    });
    const fileStream = fs.createReadStream('./report.csv');
    fileStream.pipe(res); // backpressure-aware; res is a Writable stream
    fileStream.on('error', () => {
      res.statusCode = 500;
      res.end('failed to read file');
    });
    return;
  }
  res.end('ok');
}).listen(3001);
```

## Common Pitfalls / Gotchas

- Forgetting that `node:http` does not parse request bodies automatically — you must consume the `req` Readable stream yourself (or use a framework's body-parsing middleware); accessing `req.body` directly (as in Express) is not native `http` behavior.
- Not setting a request/socket timeout on outbound `http.request` calls — a slow or hung downstream server can leave connections open indefinitely without one.
- Failing to attach an `'error'` listener on `req`/`res`/`ClientRequest` — since these are streams/EventEmitters, an unhandled error event can crash the process.
- Not reusing connections via a keep-alive `Agent` for services making many outbound requests to the same host — each request pays a fresh TCP handshake cost otherwise.
- Calling `res.end()` more than once, or writing headers after they've already been sent (`res.writeHead` after data has flowed) — throws `ERR_HTTP_HEADERS_SENT`.
- Buffering an entire large request/response body into memory (`let body = ''; req.on('data', ...)`) instead of streaming/piping when the payload could be large — risks memory exhaustion from oversized or malicious payloads; always enforce a max size.
- Confusing `http.get()` (GET-only convenience wrapper that calls `.end()` for you automatically) with `http.request()` (general-purpose, requires you to call `.end()` yourself).

## Interview Questions & Answers

**Q: Why do you need to manually handle `'data'` and `'end'` events to read a request body with raw `node:http`?**
A: Because `req` (an `IncomingMessage`) is a Readable stream, and Node delivers the body incrementally as it arrives over the socket rather than buffering and parsing it for you. Frameworks like Express add body-parsing middleware (`express.json()`) that does this stream consumption and JSON parsing on your behalf, but the underlying `node:http` module intentionally stays low-level and protocol-focused.

**Q: What's the purpose of an `http.Agent`, and why would you configure `keepAlive: true`?**
A: An Agent manages connection pooling/reuse for outbound HTTP requests. With `keepAlive: true`, the underlying TCP (and TLS, for HTTPS) connections are kept open and reused across multiple requests to the same host instead of being torn down and re-established each time, which significantly reduces latency and resource churn for services making frequent calls to the same downstream dependency.

**Q: What's the difference between `http.get()` and `http.request()`?**
A: `http.get()` is a convenience wrapper around `http.request()` that presets the method to `GET` and automatically calls `req.end()` for you, since GET requests typically have no body. `http.request()` is the general-purpose form — you must call `.end()` yourself, which is necessary for any method that sends a body (POST, PUT, PATCH) or when you want to write the body incrementally.

**Q: How would you stream a large file as an HTTP response without loading it entirely into memory?**
A: Use `fs.createReadStream(path).pipe(res)` (or `stream.pipeline()` for proper error propagation) — since `res` is itself a Writable stream, data flows from disk to the socket in backpressure-aware chunks, keeping memory usage bounded regardless of file size, rather than reading the whole file into a Buffer first with `fs.readFile`.

**Q: When would you reach for `fetch()` versus `http.request()` in modern Node?**
A: `fetch()` (built on `undici`, stable since Node 18) is simpler and standards-aligned for typical client calls — JSON APIs, straightforward GET/POST — and returns a Response with familiar Web APIs like `.json()`. `http.request()`/`https.request()` are still preferable when you need low-level control: custom Agents/connection pooling, streaming very large request/response bodies without full buffering, fine-grained timeout/socket event handling, or protocol-level behavior fetch doesn't expose.

## Related Topics

- [https.md](./https.md)
- [streams.md](./streams.md)
- [express-js-framework.md](./express-js-framework.md)
- [tls-ssl.md](./tls-ssl.md)
- [url.md](./url.md)
- [security.md](./security.md)
