# React Router Basics

A single-page application (SPA) loads one HTML page and then uses JavaScript to swap out what's rendered as the user navigates, rather than requesting a fresh HTML document from the server on every URL change the way traditional multi-page sites do. This is faster (no full page reload, no re-fetching shared assets like CSS/JS bundles) and preserves in-memory state across navigations, but it means the app itself has to take over the job the browser/server used to do: mapping a URL to "what should be on screen," updating the URL when the user navigates, and making the browser's back/forward buttons work correctly. React Router is the de facto standard library for this client-side routing in React applications.

The modern (v6+) API centers on a small set of components and hooks. `<BrowserRouter>` wraps your app and hooks it up to the browser's History API, so URL changes are managed by JavaScript instead of triggering real page loads. Inside it, `<Routes>` acts as a container that looks at the current URL and renders whichever single `<Route path="..." element={<Component />} />` matches — `path="/users/:id"` matches a URL like `/users/42`, and inside that route's component, `useParams()` returns `{ id: '42' }`, giving the component access to the dynamic segment of the URL. Routes can be nested: a parent `<Route>` can render its own layout (a header, sidebar, etc.) plus an `<Outlet />`, which is a placeholder telling React Router where to render whichever matching *child* route's element belongs — this is how a shared layout (say, a dashboard shell with navigation) wraps multiple different pages without each page having to duplicate that shell itself.

Navigation between routes should go through React Router's own components and hooks rather than plain `<a href="...">` tags or manually setting `window.location`, both of which trigger a full page reload and defeat the entire point of client-side routing. `<Link to="/about">` renders an `<a>` under the hood (so it's still accessible, still supports right-click-to-open-in-new-tab, still shows up correctly in the status bar) but intercepts the click and updates the URL/rendered route via JavaScript instead of asking the browser to navigate for real. `<NavLink>` is the same idea with automatic "active" styling support, commonly used for nav bars that need to visually indicate the current page. For navigation triggered by code rather than a click — after a form submits successfully, after an auth check redirects an unauthenticated user — `useNavigate()` returns a function you call imperatively, `navigate('/dashboard')` or `navigate(-1)` to go back.

Understanding client-side routing conceptually — that the "URL" in an SPA is really just application state that a router library keeps in sync with the actual browser URL and the rendered component tree, entirely on the client — is more important for interviews than memorizing every API detail, since it explains *why* React Router needs history management, why plain anchor tags are wrong for in-app navigation, and how server-side rendering frameworks (see [server-side-rendering.md](./server-side-rendering.md)) have to layer their own routing conventions on top of this same underlying idea.

## Examples

```jsx
// Basic setup: BrowserRouter, Routes, Route, and Link
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/users/:id" element={<UserProfile />} />
        <Route path="*" element={<NotFound />} /> {/* catch-all / 404 */}
      </Routes>
    </BrowserRouter>
  );
}
```

```jsx
// Dynamic route params with useParams, and programmatic navigation with useNavigate
import { useParams, useNavigate } from 'react-router-dom';

function UserProfile() {
  const { id } = useParams(); // matches ":id" from the route path, e.g. "42"
  const navigate = useNavigate();

  const handleDelete = async () => {
    await api.deleteUser(id);
    navigate('/users'); // imperative navigation after an action completes
  };

  return (
    <div>
      <h1>User {id}</h1>
      <button onClick={handleDelete}>Delete</button>
      <button onClick={() => navigate(-1)}>Go back</button>
    </div>
  );
}
```

```jsx
// Nested routes with a shared layout via <Outlet />
import { Routes, Route, Outlet, NavLink } from 'react-router-dom';

function DashboardLayout() {
  return (
    <div>
      <nav>
        <NavLink to="/dashboard/overview">Overview</NavLink>
        <NavLink to="/dashboard/settings">Settings</NavLink>
      </nav>
      <main>
        <Outlet /> {/* the matched child route renders here */}
      </main>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route path="overview" element={<Overview />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
```

## Common Pitfalls / Gotchas

- Using a plain `<a href="/about">` instead of `<Link to="/about">` for in-app navigation — this triggers a full browser page reload, re-downloading and re-executing the entire JS bundle and losing all in-memory React state, defeating the purpose of an SPA.
- Forgetting `<Outlet />` in a parent layout route — the parent renders fine, but none of its matched child routes ever actually appear, since `<Outlet />` is specifically where React Router injects the matched child.
- Reading dynamic segments manually by parsing `window.location.pathname` instead of using `useParams()` — fragile, and misses out on React Router's route matching already having done that parsing correctly.
- Calling `useNavigate()`/`useParams()` outside of a component actually rendered under a `<BrowserRouter>` (or during module-level code, not inside a component) — these are hooks tied to router context and only work inside components rendered within the router tree.
- Not adding a catch-all `<Route path="*" element={<NotFound />} />` — without one, navigating to an undefined URL renders nothing (no route matches) instead of a friendly 404 experience.

## Interview Questions & Answers

**Q: What problem does React Router (client-side routing) solve, and why can't you just use plain `<a>` tags for navigation in an SPA?**
A: In a single-page app, only one HTML page is ever loaded — subsequent "navigation" is just React swapping which components are rendered, driven by JavaScript reading and updating the URL via the History API. A plain `<a href>` tells the browser to make a real navigation request for a new HTML document, which reloads the entire page, re-downloads the JS bundle, and wipes out all in-memory application state — exactly what an SPA is trying to avoid. `<Link>`/`<NavLink>` intercept the click and update the URL and rendered route purely on the client instead.

**Q: How do nested routes and `<Outlet />` work together?**
A: A parent `<Route>` can render a layout component (e.g., a page shell with a header/sidebar) that includes an `<Outlet />` somewhere in its JSX. Child `<Route>` elements nested inside that parent route in the route configuration are matched against the remaining part of the URL, and whichever child matches gets rendered wherever `<Outlet />` appears in the parent's output — this lets multiple different pages share one layout without duplicating that layout's markup in every page component.

**Q: How would you read a dynamic URL segment like the `id` in `/users/:id`, and how would you navigate there programmatically after, say, a successful form submission?**
A: Define the route as `<Route path="/users/:id" element={<UserProfile />} />`; inside `UserProfile`, `useParams()` returns an object whose `id` key holds the matched segment's value from the actual URL. For programmatic navigation (not from a click), `useNavigate()` returns a function you call directly, e.g. `navigate(`/users/${newId}`)`, commonly used after an async action (form submit, delete, auth check) completes.

**Q: What's the difference between `<Link>` and `<NavLink>`?**
A: Both perform client-side navigation without a full page reload and both render an underlying `<a>` tag. `<NavLink>` additionally knows whether its `to` target matches the current URL and automatically applies styling (an `active` class, or a function-based `className`/`style` prop) when it does — which is why it's the one typically used for navigation menus that need to visually highlight the current page, while `<Link>` is used for ordinary in-content navigation links.

## Related Topics
- [introduction-to-react.md](./introduction-to-react.md)
- [server-side-rendering.md](./server-side-rendering.md)
- [conditional-rendering.md](./conditional-rendering.md)
- [lazy-loading-and-code-splitting.md](./lazy-loading-and-code-splitting.md)
- [components.md](./components.md)
