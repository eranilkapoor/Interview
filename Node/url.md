# URL

The `node:url` module provides utilities for parsing and constructing URLs. Node exposes two APIs: the modern `URL` class, which implements the WHATWG URL Standard (the same spec browsers use, so `new URL(...)` behaves identically in Node and in a browser), and the legacy `url.parse()`/`url.format()` functions, which predate the WHATWG standard, have inconsistent and sometimes surprising parsing behavior, and are formally deprecated. New code should always use the `URL` class; `url.parse` is kept only for backward compatibility with old codebases.

`new URL(input, base?)` parses a URL string into its components — `protocol`, `hostname`, `port`, `pathname`, `search`, `hash`, `username`, `password` — as live, individually settable properties. The optional second `base` argument resolves relative URLs against a base URL (`new URL('/api/users', 'https://example.com')` → `https://example.com/api/users`), which mirrors how a browser resolves relative links and is a common pattern for building request URLs against a configured base API host. `URLSearchParams`, either standalone (`new URLSearchParams('a=1&b=2')`) or via `url.searchParams`, provides a structured, iterable interface for reading and mutating query string parameters (`get`, `set`, `append`, `delete`, `getAll`, iteration) instead of manually splitting and decoding query strings.

The legacy `url.parse()` returns a plain object rather than a class instance, doesn't validate its input as strictly, handles some edge cases (like URLs without a protocol) differently from browsers, and — critically — is known to have had security issues around inconsistent parsing that could be exploited for SSRF or open-redirect style bugs when different parts of a system parsed the same URL differently. Node's documentation explicitly marks `url.parse()` as legacy and recommends the `URL` API for anything new.

Both `http.request`/`fetch` and Express-style routers commonly need URL parsing: `fetch` and `http.request` accept `URL` instances directly as their target, and reading `req.url` in a raw `http` server handler typically requires constructing `new URL(req.url, \`http://${req.headers.host}\`)` since `req.url` is only the path+query, not an absolute URL.

## Examples

```js
// Parsing a URL with the WHATWG URL class and reading its components
const url = new URL('https://user:pass@api.example.com:8443/v1/users?active=true&sort=name#top');

console.log(url.protocol);   // "https:"
console.log(url.hostname);   // "api.example.com"
console.log(url.port);       // "8443"
console.log(url.pathname);   // "/v1/users"
console.log(url.search);     // "?active=true&sort=name"
console.log(url.hash);       // "#top"
console.log(url.username);   // "user"

url.pathname = '/v2/users';
console.log(url.toString()); // updated URL with the new path
```

```js
// URLSearchParams for reading, mutating, and building query strings
const params = new URLSearchParams('page=1&limit=20&tag=node&tag=js');

console.log(params.get('page'));     // "1" (first match)
console.log(params.getAll('tag'));   // ["node", "js"]
params.set('page', '2');
params.append('tag', 'backend');
console.log(params.toString());      // "page=2&limit=20&tag=node&tag=js&tag=backend"

// Building a request URL against a configured base host
const base = 'https://api.example.com';
const requestUrl = new URL('/v1/search', base);
requestUrl.searchParams.set('q', 'node.js interview');
console.log(requestUrl.href); // "https://api.example.com/v1/search?q=node.js+interview"
```

```js
// Resolving req.url (path + query only) into a full URL inside a raw http handler
import { createServer } from 'node:http';

createServer((req, res) => {
  const fullUrl = new URL(req.url, `http://${req.headers.host}`);
  const page = Number(fullUrl.searchParams.get('page') ?? '1');

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ path: fullUrl.pathname, page }));
}).listen(3000);
```

## Common Pitfalls / Gotchas

- Using the legacy `url.parse()` in new code — it's deprecated, has inconsistent parsing behavior compared to the WHATWG standard, and has been the root cause of real security bugs (SSRF, open redirects) from parser disagreement between components.
- Forgetting that `req.url` in a raw `http`/`https` server handler is only the path and query string, not an absolute URL — you must supply a base (e.g., `req.headers.host`) to construct a full `URL` instance.
- Assuming `URLSearchParams.get()` returns all values for a repeated query param — it only returns the first; use `getAll()` for repeated keys like `?tag=a&tag=b`.
- Manually concatenating strings to build query strings instead of using `URLSearchParams`, which leads to encoding bugs (unescaped `&`, `=`, spaces, unicode).
- Not URL-encoding path segments or query values that come from user input before interpolating them into a URL string, risking malformed URLs or injection into unrelated query parameters.
- Mutating `url.search` directly with a raw string instead of using `url.searchParams`, which bypasses proper encoding and can produce an inconsistent `search`/`searchParams` state until reassigned.
- Assuming `new URL()` never throws — it throws a `TypeError` on invalid input, so parsing untrusted strings needs a `try/catch`.

## Interview Questions & Answers

**Q: Why is `url.parse()` deprecated, and what should you use instead?**
A: `url.parse()` predates the WHATWG URL Standard and has parsing behavior that diverges from what browsers (and the spec) consider correct in various edge cases, which has historically enabled bugs and security issues (e.g., SSRF from inconsistent host/path parsing between two libraries handling the same string differently). The `URL` class, which implements the WHATWG spec, is the recommended, actively maintained replacement.

**Q: What does the second argument to `new URL(input, base)` do?**
A: It provides a base URL that `input` is resolved against when `input` is a relative reference (e.g., just a path like `/v1/users`), the same way a browser resolves a relative `<a href>` against the current page's URL. If `input` is already an absolute URL, `base` is ignored. This is commonly used to build request URLs against a configured API host.

**Q: How do you handle a query parameter that appears multiple times, like `?tag=a&tag=b`?**
A: `URLSearchParams.get('tag')` returns only the first occurrence (`"a"`). To get every value, use `getAll('tag')`, which returns an array of all matches (`["a", "b"]`). Iterating the `URLSearchParams` object directly also yields every key/value pair, including duplicates.

**Q: How would you extract the query parameters from `req.url` in a raw Node `http` server?**
A: Since `req.url` only contains the path and query string (no scheme/host), you construct a full `URL` by supplying a base, typically derived from the `Host` header: `new URL(req.url, \`http://${req.headers.host}\`)`. From there, `url.pathname` gives the path and `url.searchParams` gives a structured interface to the query string.

**Q: Is `URL` in Node the same as `URL` in the browser?**
A: Yes — both implement the WHATWG URL Standard, and Node's `URL`/`URLSearchParams` are globally available (no `require` needed since Node 10+) specifically so that URL-handling code behaves identically whether it runs in a browser or in Node, which matters for isomorphic/universal JavaScript.

## Related Topics
- [http.md](./http.md)
- [https.md](./https.md)
- [util.md](./util.md)
- [globals.md](./globals.md)
- [security.md](./security.md)
