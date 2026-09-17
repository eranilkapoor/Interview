# Authentication and Authorization

Authentication answers "who is making this request?" — verifying identity. Authorization answers "is this identity allowed to do this specific thing?" — checking permissions once identity is established. Conflating the two is a common source of real security bugs: a request can be correctly authenticated (a valid, unexpired token from a real user) while still being unauthorized (that user isn't allowed to delete *this particular* resource), and an API needs to check both, in that order, on every protected request.

For a Node.js/Express API, session-based auth (a server-side session store, with a session ID in a cookie) and token-based auth (typically a JWT — JSON Web Token — sent in an `Authorization: Bearer <token>` header) are the two dominant patterns. Sessions are stateful — the server must look up the session on every request (in Redis or a database), which makes revocation trivial (just delete the session) but adds a lookup on the hot path and doesn't scale horizontally without a shared session store. JWTs are stateless — the server verifies the token's signature and reads claims directly from it without a database lookup, which scales well and works cleanly across multiple services, but revocation before expiry is hard (the token is valid until it expires, unless you maintain a blocklist, which reintroduces state). OAuth2/OIDC (OpenID Connect, which layers identity on top of OAuth2's authorization framework) is the standard for delegating authentication to a third party (Google, Okta, an enterprise SSO provider) instead of an application managing passwords itself — the app receives a token from the identity provider after a redirect-based flow and trusts it based on the provider's signature.

Authorization is commonly implemented as RBAC (Role-Based Access Control — a user has one or more roles, and roles map to permissions) for coarse-grained checks, sometimes extended to ABAC (Attribute-Based Access Control — the decision considers attributes of the user, resource, and context, not just a fixed role) for finer-grained rules like "a user can edit an order only if they created it." A secure API applies authorization checks on the server for every protected action — never relying on a client (a button being hidden in the UI) as the actual security boundary — and follows the principle of least privilege: each token/role should carry the minimum permissions needed, not broad admin-level access "just in case."

## Examples

```javascript
// Express middleware: verify a JWT and attach the decoded identity to the request
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization; // "Bearer <token>"
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  try {
    // Verify signature + expiry using the server's secret/public key —
    // NEVER decode without verifying, and never accept alg:"none".
    req.user = jwt.verify(token, process.env.JWT_PUBLIC_KEY, { algorithms: ['RS256'] });
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

```javascript
// RBAC authorization middleware, applied after authentication
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' }); // authenticated, but not authorized
    }
    next();
  };
}

app.delete('/api/documents/:id', authenticate, requireRole('admin', 'editor'), deleteDocument);

// Resource-level (ABAC-style) check: role alone isn't enough — must also own the resource
async function deleteDocument(req, res) {
  const doc = await db.documents.findById(req.params.id);
  if (!doc) return res.status(404).end();
  if (doc.ownerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not your document' });
  }
  await doc.deleteOne();
  res.status(204).end();
}
```

```javascript
// Issuing a short-lived access token + longer-lived refresh token pattern
function issueTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_PRIVATE_KEY,
    { algorithm: 'RS256', expiresIn: '15m' } // short-lived: limits damage if leaked
  );
  const refreshToken = jwt.sign(
    { sub: user.id, tokenVersion: user.tokenVersion }, // versioned so it can be invalidated
    process.env.REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}
```

## Common Pitfalls / Gotchas

- Checking authentication but forgetting resource-level authorization — e.g. verifying the JWT is valid, then fetching and deleting `req.params.id` without checking the requesting user actually owns or has rights to that specific resource (an IDOR — Insecure Direct Object Reference — vulnerability).
- Storing JWTs in `localStorage` (accessible to any JavaScript running on the page, making it vulnerable to XSS) instead of an `HttpOnly` cookie (inaccessible to JavaScript, mitigating XSS token theft, though then requiring CSRF protection instead).
- Using long-lived JWTs with no refresh mechanism, so a stolen token stays valid for its full lifetime with no way to revoke it early — the short-lived-access-token + refresh-token pattern exists specifically to bound this exposure window.
- Trusting client-supplied role/permission claims without re-verifying server-side on every request — a client should never be able to self-assert "I am an admin" in a way the server accepts unchecked.
- Rolling your own password hashing or a custom token scheme instead of using vetted libraries (`bcrypt`/`argon2` for passwords, a maintained JWT library with algorithm allow-listing) — small mistakes here (like accepting `alg: "none"`) are catastrophic and well-known attack classes.
- Not setting CORS restrictively — a wide-open `Access-Control-Allow-Origin: *` combined with credentialed requests can expose authenticated endpoints to any origin.

## Interview Questions & Answers

**Q: What's the difference between authentication and authorization?**
A: Authentication verifies *who* is making a request (validating credentials/a token to establish identity). Authorization checks whether that already-identified user is *allowed* to perform the specific action they're requesting. A request can pass authentication (a valid token) and still fail authorization (that user doesn't have permission for this resource) — both checks are required, and authorization should never be skipped just because a token is valid.

**Q: Session-based auth vs JWT-based auth — what are the tradeoffs?**
A: Sessions are stateful: the server stores session data (in Redis/a DB) and looks it up per request via a session ID cookie — revocation is trivial (delete the session), but it requires a shared session store to scale across multiple servers and adds a lookup on every request. JWTs are stateless: the server verifies a cryptographic signature and reads claims directly from the token with no database lookup, which scales cleanly across services, but revoking a JWT before its natural expiry is hard without reintroducing server-side state (a blocklist), so JWTs are usually kept short-lived and paired with a refresh-token flow.

**Q: How does OAuth2/OIDC fit into an application's authentication, and how is it different from an app rolling its own login?**
A: OAuth2 is an authorization delegation framework, and OIDC layers an identity/authentication protocol on top of it. Instead of an application storing and verifying passwords itself, the user is redirected to an identity provider (Google, an enterprise SSO, Okta), authenticates there, and the provider issues a signed token back to the application asserting who the user is. The application trusts that token because it can verify the provider's signature, rather than managing credentials and password security itself — this is standard for enterprise SSO and reduces the attack surface of credential handling in each individual application.

**Q: What is RBAC, and when would you need something more fine-grained than it?**
A: Role-Based Access Control assigns users one or more roles, and permissions are attached to roles rather than individual users — simple to reason about and manage at scale. It becomes insufficient when authorization depends on more than just a fixed role, e.g. "a user can edit an order only if they created it" or "a manager can approve requests only for their own team" — those checks require looking at attributes of the specific resource and requester (ownership, team membership, context), which is where ABAC-style resource-level checks or explicit ownership checks in the handler are needed in addition to role checks.

**Q: How would you secure a Node.js REST API end-to-end?**
A: HTTPS everywhere (never plaintext for credentials/tokens), authentication middleware verifying a token's signature and expiry before any handler runs, authorization checks (role and/or resource-level) applied per-route or per-action, strict input validation on every endpoint, rate limiting on auth endpoints especially (to slow brute force), security headers via something like Helmet (HSTS, disabling `X-Powered-By`, a sane CSP), CORS configured to an explicit allow-list rather than `*`, centralized structured logging (without logging secrets/tokens), and secrets (JWT signing keys, DB credentials) pulled from a secrets manager rather than hardcoded or committed to source control.

## Related Topics
- [security.md](./security.md)
- [http.md](./http.md)
- [https.md](./https.md)
- [express-routing-middleware-error-handling.md](./express-routing-middleware-error-handling.md)
- [crypto.md](./crypto.md)
