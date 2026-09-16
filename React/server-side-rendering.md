# Server-Side Rendering (SSR)

In a purely client-side rendered (CSR) React app, the server sends the browser a nearly empty HTML document (typically just a `<div id="root"></div>` and a `<script>` tag), and the browser has to download the JavaScript bundle, execute it, and let React build the entire UI before the user sees anything meaningful — a blank or loading-spinner screen for however long that takes. Server-side rendering addresses this by having the *server* run React's rendering logic first: functions like `renderToString` (or the newer, streaming-capable `renderToPipeableStream`) take your component tree and produce actual HTML markup on the server, which is sent to the browser as a already-populated HTML document. The browser can then paint real, meaningful content immediately, before any JavaScript has even finished downloading — this is the core benefit of SSR: a much faster perceived first paint, especially on slow networks or lower-powered devices.

That server-rendered HTML is not interactive on its own, though — it has no event listeners attached, and none of your component's state/effects have run in the browser yet. Making it interactive is called **hydration**: the client-side React code runs against the *same* component tree, but instead of throwing away the server-rendered DOM and rebuilding it from scratch, React walks the existing markup, attaches event listeners, and reconciles its internal representation with what's already on the page, "waking it up" into a fully interactive app without a visible re-render. Hydration requires the server-rendered output and the client's initial render to match — a mismatch (e.g., rendering something dependent on `window` or the current time differently on server vs. client) produces hydration warnings/errors and can cause visibly incorrect content to flash or be discarded.

SSR sits between two other common rendering strategies, and interview questions often ask you to place all three: client-side rendering (CSR) ships minimal HTML and does all rendering in the browser — simplest to reason about and cheapest to host (a static file server is enough), but slowest first paint and worst for SEO on crawlers that don't execute JavaScript well. SSR renders HTML per-request on a server at request time, giving a fast first paint and good SEO (crawlers see fully-formed HTML immediately) at the cost of needing a running server (or serverless function) to do that rendering work on every request, and added server-side complexity. Static site generation (SSG) is a third option — rendering the HTML once at *build* time rather than per-request, producing plain static files that can be served from a CDN with SSR's fast-first-paint and SEO benefits but without needing a server to render on every request; it only works well for content that's the same for every visitor and doesn't need to reflect live, per-request data.

In practice, very few teams hand-roll `renderToString`/hydration wiring, request-level routing, and data-fetching coordination themselves — frameworks like Next.js (and others, like Remix) provide SSR, SSG, streaming, and routing as an integrated, production-ready system out of the box, handling the substantial edge cases (code splitting per route, data fetching coordinated with rendering, caching, streaming) that a hand-built SSR setup would otherwise have to solve from scratch. Knowing the underlying mechanism — render to HTML on the server, hydrate on the client — is what interviews are really testing, since it's what explains why these frameworks are structured the way they are.

## Examples

```jsx
// Conceptual server-side rendering with renderToString (Node/Express-style)
import { renderToString } from 'react-dom/server';
import App from './App';

app.get('*', (req, res) => {
  const appHtml = renderToString(<App />); // React tree -> HTML string, on the server
  res.send(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="root">${appHtml}</div>
        <script src="/bundle.js"></script>
      </body>
    </html>
  `);
});
```

```jsx
// Client-side hydration: attaches to the server-rendered markup instead of
// rebuilding it from scratch, making it interactive.
import { hydrateRoot } from 'react-dom/client';
import App from './App';

hydrateRoot(document.getElementById('root'), <App />);
// If the server HTML and this initial client render don't match, React warns
// and may re-render the mismatched portion from scratch.
```

```jsx
// A hydration-mismatch trap: rendering something environment-dependent
// differently on the server vs. the client.
function Greeting() {
  // BAD: `Date.now()`/`window` differ between server render time and client
  // hydration time, causing a mismatch warning and a flash of incorrect content.
  return <p>Rendered at: {typeof window !== 'undefined' ? Date.now() : 'server'}</p>;
}

// Safer pattern: render a stable value first, then update after hydration
// via useEffect, which only runs on the client.
function GreetingFixed() {
  const [renderedAt, setRenderedAt] = useState(null);
  useEffect(() => setRenderedAt(Date.now()), []); // runs client-side, post-hydration
  return <p>Rendered at: {renderedAt ?? 'loading...'}</p>;
}
```

## Common Pitfalls / Gotchas

- Rendering something that differs between the server and the initial client render (current time, `Math.random()`, `window`/`localStorage`-dependent values, locale-dependent formatting without matching config) — this causes hydration mismatches, visible flashes of incorrect content, and React warnings/errors.
- Assuming SSR automatically makes an app interactive faster — it improves *first paint* (something visible sooner), but the app isn't actually interactive until hydration finishes, which still requires downloading and executing the JS bundle; a large bundle can still leave a page looking ready but not yet responding to clicks.
- Confusing SSR with SSG — SSR renders fresh HTML on every request (needs a live server), while SSG renders once at build time and serves static files; using SSR for content that never changes wastes server resources that SSG would avoid entirely.
- Hand-rolling `renderToString` + hydration + routing + data fetching from scratch for a production app instead of using an established framework (Next.js, Remix) — the amount of correctly-handled edge cases (streaming, code splitting per route, cache invalidation, error boundaries during SSR) is substantial and easy to get subtly wrong.
- Forgetting that SSR requires a running server (or serverless function) capable of executing React on every request — unlike a purely static CSR or SSG deployment, this adds real infrastructure and scaling considerations (server compute cost, cold starts in serverless environments).

## Interview Questions & Answers

**Q: What is server-side rendering, and what specific problem does it solve compared to pure client-side rendering?**
A: SSR runs React's rendering logic on the server to produce actual HTML markup for a request, which is sent to the browser already populated with content, instead of sending an empty shell that only gets filled in after the client downloads and executes the full JS bundle. It solves the "blank screen while JS loads" problem of CSR, giving a much faster perceived first paint, and it also helps SEO, since crawlers see fully-formed HTML immediately rather than an empty `<div>` that only becomes real content after JavaScript execution.

**Q: What is hydration, and what goes wrong if the server-rendered HTML doesn't match what the client renders initially?**
A: Hydration is the process where client-side React attaches to the already-present, server-rendered DOM — adding event listeners and reconciling its internal tree with the existing markup — instead of discarding it and rendering from scratch. If the server's output and the client's initial render don't match (e.g., due to environment-dependent values like the current time or `window`), React logs a hydration mismatch warning and may have to discard and re-render the mismatched portion, which can cause a visible flash of different content and defeats some of SSR's benefit.

**Q: How does SSR differ from static site generation (SSG)?**
A: SSR renders HTML fresh on the server for every incoming request, so it can reflect live, per-request data, but it requires a running server (or serverless function) to do that rendering work each time. SSG renders the HTML once, at build time, producing static files that can be served from a CDN with no per-request rendering cost — appropriate for content that's the same for every visitor (marketing pages, blog posts) but not for content that needs to be fresh per request (a logged-in user's dashboard).

**Q: Why do most teams use a framework like Next.js instead of implementing SSR by hand?**
A: Hand-rolling SSR correctly involves a lot more than calling `renderToString` once — coordinating data fetching with rendering so the HTML isn't sent before the data it needs is ready, per-route code splitting so the client doesn't download the whole app's JS upfront, streaming the response so parts of the page can be sent before the whole tree finishes rendering, and handling errors during server rendering gracefully. Frameworks like Next.js (or Remix) provide all of this as an integrated, battle-tested system, which is why hand-rolled SSR is rare outside of learning exercises or highly specialized infrastructure.

## Related Topics
- [react-router-basics.md](./react-router-basics.md)
- [lazy-loading-and-code-splitting.md](./lazy-loading-and-code-splitting.md)
- [use-effect.md](./use-effect.md)
- [react-performance-optimization.md](./react-performance-optimization.md)
- [introduction-to-react.md](./introduction-to-react.md)
