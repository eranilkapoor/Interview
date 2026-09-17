# TLS / SSL

The `node:tls` module implements Transport Layer Security (TLS, the modern successor to SSL — SSL itself is deprecated and insecure) on top of the `node:net` module's TCP sockets. Where `net.createServer`/`net.connect` give you raw, unencrypted TCP, `tls.createServer`/`tls.connect` wrap the same socket semantics with a TLS handshake, encrypting all data in transit and (optionally) authenticating the identity of one or both endpoints via X.509 certificates. Node's TLS implementation is built on OpenSSL, so the cipher suites, protocol versions (TLS 1.2, 1.3), and certificate handling it supports track what OpenSSL exposes.

The `https` module is essentially `http` combined with `tls`: `https.createServer` accepts the same options as `tls.createServer` (`key`, `cert`, `ca`, etc.) plus the same request/response handling as `http.createServer`. In other words, `https = http (application layer) + tls (transport layer security)`. The same relationship holds between `http2` with the `allowHTTP1`/TLS options. Understanding `tls` directly matters when you need raw encrypted TCP (e.g., a custom protocol, a database driver, an SMTP client) rather than HTTP specifically, or when you need fine-grained control over the handshake — mutual TLS (mTLS), custom certificate validation, SNI-based multi-domain hosting, or cipher suite restriction.

A TLS server needs a private key and a certificate (a public key signed by a Certificate Authority, or self-signed for development/testing). `tls.createServer({ key, cert })` performs the handshake automatically; `tls.connect({ ca })` on the client side validates the server's certificate against a set of trusted CAs (by default, Node's bundled root CA list, same as most browsers). Setting `rejectUnauthorized: false` disables this validation — this is sometimes done for local development against self-signed certs, but doing so in production defeats the entire purpose of TLS and opens the connection to man-in-the-middle attacks.

SNI (Server Name Indication) lets a single TLS server present different certificates depending on the hostname the client is requesting, which is what allows one IP/port to serve HTTPS for multiple unrelated domains — Node supports this via the `SNICallback` option on `tls.createServer`. Modern TLS deployments should pin to TLS 1.2+ (`minVersion: 'TLSv1.2'`), since TLS 1.0/1.1 and all SSL versions have known vulnerabilities and are disabled by default in current Node/OpenSSL builds.

## Examples

```js
// Minimal TLS server (raw encrypted TCP, not HTTP) using a self-signed cert
import { createServer } from 'node:tls';
import { readFileSync } from 'node:fs';

const options = {
  key: readFileSync('./server-key.pem'),
  cert: readFileSync('./server-cert.pem'),
  minVersion: 'TLSv1.2'
};

const server = createServer(options, (socket) => {
  console.log('Client connected, TLS version:', socket.getProtocol());
  socket.write('Welcome to the encrypted channel\n');
  socket.on('data', (chunk) => console.log('Received:', chunk.toString()));
});

server.listen(8443, () => console.log('TLS server listening on 8443'));
```

```js
// TLS client connecting to that server, validating the cert against a custom CA
import { connect } from 'node:tls';
import { readFileSync } from 'node:fs';

const socket = connect(
  {
    host: 'localhost',
    port: 8443,
    ca: readFileSync('./server-cert.pem'), // trust our self-signed cert explicitly
    rejectUnauthorized: true
  },
  () => {
    console.log('Handshake complete, authorized:', socket.authorized);
    socket.write('Hello from client');
  }
);

socket.on('data', (chunk) => console.log('Server says:', chunk.toString()));
```

```js
// https module = http + tls: same request/response API, with TLS options
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';

const server = createServer(
  {
    key: readFileSync('./server-key.pem'),
    cert: readFileSync('./server-cert.pem')
  },
  (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ secure: true, protocol: req.socket.getProtocol() }));
  }
);

server.listen(443, () => console.log('HTTPS server listening on 443'));
```

## Common Pitfalls / Gotchas

- Setting `rejectUnauthorized: false` on a client in production — this silently disables certificate validation, making the connection vulnerable to man-in-the-middle attacks. It should only ever be used for local development against self-signed certs.
- Confusing SSL and TLS — SSL (all versions) is deprecated and insecure; modern Node defaults to TLS 1.2/1.3. Documentation and option names still say "SSL" for historical reasons (`ssl` folder names, `SSL_OP_*` constants), but the actual protocol in use is TLS.
- Hardcoding or committing private keys/certificates to source control — they belong in a secrets manager or environment-injected file, never in the repo.
- Letting a certificate expire unnoticed — TLS servers with expired certs cause every client connection to fail; production systems need certificate expiry monitoring/auto-renewal (e.g., via Let's Encrypt/ACME).
- Not setting `minVersion` and assuming old defaults are safe — always explicitly pin to `TLSv1.2` or higher for anything handling sensitive data.
- Forgetting that self-signed certificates will fail validation for any client that doesn't explicitly trust them, which is expected and correct behavior, not a bug to "work around" with `rejectUnauthorized: false` in production.
- Not handling the `'error'` event on TLS sockets — handshake failures (bad cert, protocol mismatch) emit errors that crash the process if unhandled.
- Ignoring `socket.authorized`/`authorizationError` in mutual TLS setups — you need to explicitly check that the client's presented certificate was actually validated, not just that a handshake occurred.

## Interview Questions & Answers

**Q: What's the relationship between `http`, `https`, and `tls` in Node.js?**
A: `tls` provides encrypted, certificate-authenticated sockets on top of `net`'s raw TCP. `https` is `http`'s request/response API combined with a TLS-wrapped socket — internally, `https.createServer` accepts the same TLS options (`key`, `cert`, `ca`) as `tls.createServer`, plus HTTP request handling on top. So `https = http + tls`, the same way `net` and `tls` relate at the transport layer.

**Q: What does `rejectUnauthorized: false` do, and why is it dangerous in production?**
A: It tells the TLS client to skip validating the server's certificate against trusted CAs, so the connection proceeds even with an invalid, expired, or spoofed certificate. This defeats TLS's core guarantee — that you're actually talking to the server you intended to — and exposes the connection to man-in-the-middle attacks. It's sometimes used temporarily for local development against self-signed certs, but should never ship to production.

**Q: What is SNI and why does it matter for a TLS server hosting multiple domains?**
A: Server Name Indication is a TLS extension where the client announces the hostname it's connecting to during the handshake, before the server picks which certificate to present. Without SNI, a server bound to one IP/port could only present a single certificate for all connections; with SNI (`SNICallback` in `tls.createServer`), the server can serve different certificates for different domains from the same listening socket — the basis of most shared HTTPS hosting.

**Q: How would you set up mutual TLS (mTLS) in Node, and why would you use it?**
A: On the server, set `requestCert: true` and provide a `ca` list of certificates authorized to act as clients; the server then validates the client's presented certificate the same way clients validate servers. This is used for service-to-service authentication (e.g., internal microservices, IoT devices) where you want cryptographic proof of both parties' identities rather than relying solely on a bearer token or password.

**Q: Why does Node bundle a default list of root CAs, and when would you override it?**
A: Node ships with a curated list of trusted root Certificate Authorities (similar to what browsers trust), so that `https.request`/`tls.connect` calls to public servers with standard certificates work out of the box. You'd override it via the `ca` option when connecting to a server with a self-signed or internally-issued certificate (e.g., a private CA inside a company), so Node knows to trust that specific certificate chain instead of rejecting it as unknown.

## Related Topics
- [https.md](./https.md)
- [http.md](./http.md)
- [crypto.md](./crypto.md)
- [security.md](./security.md)
- [dgram.md](./dgram.md)
- [error-handlings.md](./error-handlings.md)
