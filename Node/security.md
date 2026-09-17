# Security in Node.js

Node.js security spans several distinct concern areas: vulnerabilities in third-party dependencies (the vast majority of a typical Node app's code is `node_modules`, not code you wrote), classes of injection attacks specific to how Node APIs work (command injection via `child_process`, NoSQL/SQL injection via unsanitized query construction, prototype pollution via unsafe object merging), secrets/credential handling, and hardening an HTTP server against common web-layer attacks. A secure Node application requires attention to all of these, not just "sanitize your inputs."

Dependency risk is often the largest attack surface in practice — a single vulnerable transitive dependency deep in the tree can expose the whole application. `npm audit` (and equivalents `yarn audit`, `pnpm audit`) checks installed packages against known vulnerability databases and reports severity levels; `npm audit fix` attempts automatic remediation for fixable issues. This should run in CI, not just occasionally by hand, and lockfiles (`package-lock.json`) should be committed so the exact audited dependency tree is what actually gets deployed. Prototype pollution is a Node/JavaScript-specific vulnerability class where an attacker-controlled object (often from parsed JSON in a request body) is merged/assigned into another object using a path like `__proto__` or `constructor.prototype`, allowing the attacker to inject properties onto `Object.prototype` itself — which can then affect unrelated code throughout the application (e.g., bypassing an `if (obj.isAdmin)` check that unexpectedly inherits `isAdmin: true` from a polluted prototype). Libraries doing deep merge/clone of untrusted input (older versions of `lodash.merge`, naive custom recursive merges) have historically been common vectors.

Command injection happens when untrusted input is passed into `child_process.exec()` (which runs a string through a shell, interpreting shell metacharacters like `;`, `|`, `` ` ``) rather than `child_process.execFile()`/`spawn()` (which pass arguments as an array directly to the executable, bypassing shell interpretation entirely). `exec(\`convert ${userFilename} out.png\`)` with an attacker-supplied filename like `"a; rm -rf /"` is the canonical vulnerable pattern. The general principle — never build a command/query string by concatenating untrusted input, always use parameterized/array-based APIs — also applies to SQL (parameterized queries / prepared statements instead of string concatenation) and NoSQL query construction (e.g., MongoDB queries built from raw request bodies allowing operator injection like `{ "$gt": "" }` to bypass equality checks).

Secrets (API keys, database credentials, signing keys) should never be hardcoded in source or committed to version control — they belong in environment variables (`process.env`) injected by the deployment platform, or a dedicated secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) for anything beyond simple setups. `.env` files are common for local development but should be `.gitignore`d, not committed. For Express-based HTTP servers specifically, `helmet` middleware sets a collection of security-related HTTP response headers (`Content-Security-Policy`, `X-Content-Type-Options`, `Strict-Transport-Security`, etc.) that mitigate common browser-side attack vectors (clickjacking, MIME-sniffing, some XSS vectors) with minimal configuration. Rate limiting (`express-rate-limit` or similar, or infrastructure-level like an API gateway/WAF) protects against brute-force and denial-of-service style abuse by capping request rates per client. Input validation (via libraries like `zod`, `joi`, or `class-validator`) at the boundary of the system — rejecting malformed/unexpected input before it reaches business logic — is a foundational defense that reduces the surface for most of the injection classes above.

## Examples

```js
// Command injection: vulnerable exec() vs safe execFile()
import { exec, execFile } from 'node:child_process';

// VULNERABLE: userFilename is interpolated into a shell command string.
// An attacker could pass: "photo.png; rm -rf ."
function convertVulnerable(userFilename) {
  exec(`convert ${userFilename} output.png`, (err, stdout) => {
    if (err) return console.error(err);
    console.log(stdout);
  });
}

// SAFE: arguments are passed as an array directly to the executable,
// never interpreted by a shell, so shell metacharacters are inert.
function convertSafe(userFilename) {
  execFile('convert', [userFilename, 'output.png'], (err, stdout) => {
    if (err) return console.error(err);
    console.log(stdout);
  });
}
```

```js
// Prototype pollution: an unsafe recursive merge vs a guarded one
function unsafeMerge(target, source) {
  for (const key in source) {
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = target[key] || {};
      unsafeMerge(target[key], source[key]); // no key filtering — vulnerable
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

function safeMerge(target, source) {
  const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  for (const key of Object.keys(source)) {
    if (DANGEROUS_KEYS.has(key)) continue; // block prototype-chain keys explicitly
    if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = target[key] || {};
      safeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Attack payload parsed from untrusted JSON request body:
const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
unsafeMerge({}, payload);
console.log(({}).isAdmin); // true on unpatched Node/engines without built-in guards — polluted!
```

```js
// Express hardening: helmet, rate limiting, and input validation at the boundary
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const app = express();
app.use(helmet()); // sets CSP, X-Content-Type-Options, HSTS, etc.
app.use(express.json({ limit: '100kb' })); // cap body size to limit DoS via huge payloads

app.use(rateLimit({ windowMs: 60_000, max: 100 })); // 100 requests/minute per client

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100)
});

app.post('/users', (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }
  // result.data is now validated and safe to use
  res.status(201).json({ id: 1, ...result.data });
});

app.listen(3000);
```

## Common Pitfalls / Gotchas

- Using `child_process.exec()` with any string built from untrusted input — always prefer `execFile()`/`spawn()` with an argument array so a shell never interprets the input.
- Deep-merging or recursively assigning properties from parsed JSON request bodies without filtering out `__proto__`/`constructor`/`prototype` keys, opening the door to prototype pollution.
- Building SQL or NoSQL queries via string concatenation or by passing raw request bodies directly into query filters, enabling SQL injection or NoSQL operator injection (e.g., `{"$ne": null}`).
- Hardcoding API keys, database passwords, or signing secrets directly in source files, or committing a populated `.env` file to version control.
- Trusting `npm audit`'s absence of findings as proof of security — it only catches *known, disclosed* vulnerabilities in the dependency database; it says nothing about your own code's logic flaws.
- Skipping input validation because "the frontend already validates it" — client-side validation is trivially bypassed by anyone calling the API directly, so server-side validation is mandatory, not optional.
- Returning detailed internal error messages or stack traces to API clients in production, which leaks implementation details useful to an attacker.
- Running the Node process as root/an over-privileged user in production, so that a successful compromise of the app grants more system access than necessary — run under a least-privileged dedicated user/container.
- Not setting a request body size limit, making the server vulnerable to memory-exhaustion DoS from oversized payloads.

## Interview Questions & Answers

**Q: What is prototype pollution, and how does it happen in a Node.js application?**
A: It's a vulnerability where an attacker gets attacker-controlled data (often from a JSON request body) merged into an object in a way that lets them set properties on `Object.prototype` itself — typically by including a `__proto__` or `constructor.prototype` key in the input, which a naive recursive merge/clone function then walks into and assigns through. Because `Object.prototype` is shared by every plain object in the process, this can silently affect unrelated logic elsewhere in the app (e.g., an authorization check that reads a property which now inherits an attacker-set value). The fix is to explicitly reject dangerous keys during merges, use `Object.create(null)` for untrusted data maps, or use library functions that already guard against this.

**Q: Why is `child_process.exec()` more dangerous than `execFile()` or `spawn()` when handling user input?**
A: `exec()` runs its command string through a system shell, which interprets shell metacharacters (`;`, `|`, `` ` ``, `&&`, etc.) — if any part of that string is attacker-controlled, they can inject additional commands. `execFile()` and `spawn()` take the executable and its arguments as a separate array and invoke the executable directly without shell interpretation, so metacharacters in the arguments are treated as literal data rather than shell syntax.

**Q: What does `npm audit` actually check, and what are its limitations?**
A: It compares your installed (and locked) dependency tree against a database of publicly disclosed vulnerabilities and reports matches by severity, often with suggested fixes/upgrade paths. Its limitation is that it can only catch vulnerabilities that have already been discovered, disclosed, and cataloged — it says nothing about zero-days, and nothing at all about security bugs in your own application code, which is why it's necessary but not sufficient as a security practice.

**Q: How should secrets like database passwords and API keys be managed in a Node application?**
A: They should never be hardcoded in source or committed to version control. The standard approach is injecting them as environment variables (`process.env.DB_PASSWORD`) set by the deployment platform, with `.env` files used only for local development and explicitly `.gitignore`d. For production systems handling sensitive data at scale, a dedicated secrets manager (Vault, AWS/GCP/Azure secret stores) is preferable, since it adds access auditing, rotation, and avoids secrets sitting in plaintext environment configuration.

**Q: What does Helmet do, and why doesn't it replace other security practices?**
A: Helmet is Express middleware that sets a set of HTTP response headers known to mitigate common browser-side attacks — Content-Security-Policy (restricts what scripts/resources can load), X-Content-Type-Options (prevents MIME-sniffing), Strict-Transport-Security (enforces HTTPS), and others — with sensible defaults. It hardens the browser-facing attack surface, but it does nothing about server-side issues like injection vulnerabilities, weak authentication, unvalidated input, or dependency vulnerabilities, so it's one layer of defense-in-depth, not a complete security solution on its own.

## Related Topics
- [child-process.md](./child-process.md)
- [crypto.md](./crypto.md)
- [tls-ssl.md](./tls-ssl.md)
- [error-handlings.md](./error-handlings.md)
- [package-json.md](./package-json.md)
- [express-routing-middleware-error-handling.md](./express-routing-middleware-error-handling.md)
