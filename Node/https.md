# HTTPS

The `node:https` module provides the same server/client API shape as `node:http` — `https.createServer()`, `https.request()`, `https.get()` — but wraps every connection in TLS (Transport Layer Security) encryption. Internally, `https` is built on top of both `node:http` (for the actual HTTP protocol semantics — methods, headers, request/response streaming) and `node:tls` (for the encrypted transport layer), so nearly everything you know about `req`/`res` as Readable/Writable streams from `http` carries over directly; the difference is entirely at the connection-establishment and transport level.

To create an HTTPS server, `https.createServer(options, requestListener)` requires TLS credentials in `options` — most commonly `key` (the server's private key, PEM format) and `cert` (the server's certificate, PEM format), typically read from disk with `fs.readFileSync`. Optionally, `ca` supplies intermediate/CA certificates for chain-of-trust validation, and other TLS-specific options (`ciphers`, `minVersion`, `secureOptions`) let you constrain the negotiated protocol version and cipher suite for security hardening. Once configured, the rest of the request-handling code — reading the request stream, writing the response — is identical to `node:http`.

On the client side, `https.request()`/`https.get()` mirror their `http` counterparts but negotiate TLS automatically for `https://` URLs. By default, Node validates the server's certificate against its bundled list of trusted root CAs and will throw a certificate verification error (e.g., `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, self-signed cert errors) if validation fails — this is a critical security control that should essentially never be disabled in production (`rejectUnauthorized: false` disables it and reopens the connection to man-in-the-middle attacks; it's sometimes used temporarily for local development against self-signed certs, but that should never ship).

In practice, many production Node deployments don't terminate TLS in the Node process itself — instead, a reverse proxy or load balancer (nginx, an AWS/GCP/Azure load balancer, Cloudflare) handles TLS termination at the edge, decrypts incoming HTTPS traffic, and forwards plain HTTP to the Node app running behind it on a private network. This simplifies certificate rotation/renewal (handled centrally by the proxy layer, often automated via Let's Encrypt/ACME) and offloads the CPU cost of the TLS handshake from the application process. When Node does terminate TLS directly (common for internal services, low-traffic apps, or when a proxy layer isn't available), it needs the private key material available to the process, which raises its own operational/security considerations around key storage and rotation.

## Examples

```js
// An HTTPS server with a private key and certificate
const https = require('node:https');
const fs = require('node:fs');

const options = {
  key: fs.readFileSync('./server-key.pem'),
  cert: fs.readFileSync('./server-cert.pem'),
};

const server = https.createServer(options, (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('This response was sent over TLS\n');
});

server.listen(443, () => console.log('HTTPS server listening on :443'));
```

```js
// An HTTPS client request, with explicit certificate validation left ON
const https = require('node:https');

https.get('https://api.example.com/status', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => console.log('status:', res.statusCode, data));
}).on('error', (err) => {
  // A failed TLS handshake (e.g., expired/invalid cert) surfaces here
  console.error('request failed:', err.message);
});

// NEVER do this in production -- disables certificate validation entirely:
// https.get(url, { rejectUnauthorized: false }, callback);
```

```js
// Redirecting plain HTTP to HTTPS -- a common pattern when Node terminates TLS itself
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');

http.createServer((req, res) => {
  const host = req.headers.host.split(':')[0];
  res.writeHead(301, { Location: `https://${host}${req.url}` });
  res.end();
}).listen(80);

https.createServer(
  {
    key: fs.readFileSync('./server-key.pem'),
    cert: fs.readFileSync('./server-cert.pem'),
  },
  (req, res) => res.end('secure response')
).listen(443);
```

## Common Pitfalls / Gotchas

- Setting `rejectUnauthorized: false` on a client request to work around a certificate error — this disables TLS certificate validation entirely and exposes the connection to man-in-the-middle attacks; it should never be used outside of throwaway local development.
- Forgetting to include intermediate CA certificates (`ca` option or a full chain file) — some clients will fail to validate a certificate whose chain isn't complete, even though the leaf certificate itself is valid.
- Hardcoding certificate/key file paths without a rotation plan — certificates expire (commonly every 90 days with Let's Encrypt), and a server that doesn't reload updated credentials will start failing handshakes once the cert lapses.
- Not realizing that when a reverse proxy terminates TLS in front of Node, the Node process sees plain HTTP — code that checks `req.protocol === 'https'` or similar needs to trust `X-Forwarded-Proto` (and only when the proxy is genuinely trusted) rather than inspecting the raw connection.
- Using overly permissive TLS settings (old `minVersion` like TLSv1.0/1.1, weak cipher suites) for backward compatibility, which weakens the actual security TLS is meant to provide.
- Mixing up private key security: storing the `key` PEM file in a way that's readable by unintended processes/users, or committing it to source control.
- Assuming `https` module usage automatically implies "secure" without also considering broader security practices from the [security.md](./security.md) topic — HSTS headers, secure cookies, cipher configuration, and certificate pinning where relevant for clients.

## Interview Questions & Answers

**Q: What's the fundamental difference between `node:http` and `node:https`?**
A: `https` wraps the same HTTP protocol semantics in TLS encryption for the connection. It's built on both `node:http` (for request/response, headers, streaming) and `node:tls` (for the encrypted transport). Setting it up requires TLS credentials (`key`/`cert`, and optionally `ca`) that `http` doesn't need, but the request-handling code (reading `req`, writing `res`) is otherwise identical.

**Q: Why is `rejectUnauthorized: false` dangerous, and when (if ever) is it acceptable?**
A: It disables Node's validation of the server's TLS certificate against trusted CAs, meaning the client will happily connect even to a server presenting an invalid, expired, or attacker-controlled certificate — defeating TLS's core purpose of authenticating who you're talking to and opening the door to man-in-the-middle attacks. It's sometimes used temporarily against a self-signed certificate in local development, but it should never be present in code that reaches production.

**Q: Why do many production Node apps not use `node:https` directly, even though the app serves HTTPS traffic to users?**
A: Because TLS termination is commonly handled by a reverse proxy or load balancer in front of the Node process (nginx, a cloud load balancer, Cloudflare), which decrypts HTTPS and forwards plain HTTP internally over a private network. This centralizes certificate management/rotation (often automated), offloads TLS handshake CPU cost from the app, and lets Node focus purely on application logic behind a trusted network boundary.

**Q: What options would you configure on `https.createServer` to harden TLS settings for security compliance?**
A: `key`/`cert` (and `ca` for chain completeness) are required baseline; beyond that, `minVersion: 'TLSv1.2'` (or higher) to reject outdated/insecure protocol versions, `ciphers` to restrict to strong cipher suites, and periodic certificate rotation. These map to the same underlying concerns covered by `node:tls`.

**Q: If a Node app is behind a reverse proxy that terminates TLS, how does the app know the original request was HTTPS?**
A: The proxy typically sets a header like `X-Forwarded-Proto: https` on the forwarded (plain HTTP) request. The app can trust and read that header — but only when it's guaranteed every request actually passes through the trusted proxy (otherwise a client could spoof that header directly), which is usually enforced at the network level so the app is unreachable except via the proxy.

## Related Topics

- [http.md](./http.md)
- [tls-ssl.md](./tls-ssl.md)
- [security.md](./security.md)
- [crypto.md](./crypto.md)
- [streams.md](./streams.md)
