# Portals

A portal, created via `ReactDOM.createPortal(child, container)`, lets you render a subtree of React elements into a DOM node that lives outside the normal parent-child DOM hierarchy of the component that renders it — while that subtree still behaves, from React's perspective, exactly as if it were rendered in its original place in the component tree. `createPortal` takes two arguments: the React children to render (any valid JSX), and the actual DOM node to render them into (commonly a node outside the app's root, like a dedicated `<div id="modal-root">` in `index.html`). The call is typically made from within a component's `render`/return, and React treats its return value as a normal element to include in the tree, even though its rendered DOM output physically ends up somewhere else entirely.

The key nuance that makes portals genuinely useful, rather than just an alternative way to call `document.body.appendChild`, is that React's tree relationships — event bubbling and Context — are preserved across the portal boundary even though the actual DOM node is physically elsewhere. An event fired inside a portaled child still bubbles up through the *React* tree to ancestor event handlers exactly as if no portal were involved, because React's synthetic event system follows the component tree, not the raw DOM tree. Similarly, a portaled subtree still has access to any Context providers above it in the component tree, since Context also follows the React tree rather than the DOM tree. This means you can portal a component's rendered output elsewhere in the DOM without losing any of the surrounding application's event handling or shared context — the portal only changes *where in the DOM* the pixels land, not the component's logical position in the app.

The classic motivating use case is anything that needs to visually "escape" its parent's DOM container — most often because that parent has `overflow: hidden`, a constrained `z-index` stacking context, or fixed dimensions that would otherwise clip or misposition the content. Modals, tooltips, dropdown menus, and toast/notification systems are the textbook examples: a modal triggered from deep inside a scrollable panel needs to render as a full-screen overlay, not clipped inside that panel's bounds, and a portal lets the modal's markup live at the top of the actual DOM (as a sibling of the app root) while its *trigger logic and state* remain wherever it's logically owned in the component tree.

Portals are a rendering-target mechanism, not a state-management or logic-sharing one — they don't change how props, state, or hooks work inside the portaled component at all. It's also worth being precise that a portal doesn't opt a subtree out of React's lifecycle or reconciliation; the portaled content still mounts, updates, and unmounts along with its logical position in the tree, it just paints to a different DOM location while doing so.

## Examples

```jsx
// A basic modal rendered via a portal into a dedicated DOM node outside the app root
import { createPortal } from 'react-dom';

function Modal({ children, onClose }) {
  const modalRoot = document.getElementById('modal-root'); // <div id="modal-root"> in index.html
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    modalRoot
  );
}

function App() {
  const [showModal, setShowModal] = useState(false);
  return (
    <div className="scroll-container" style={{ overflow: 'hidden' }}>
      <button onClick={() => setShowModal(true)}>Open Modal</button>
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <p>I render outside .scroll-container, so overflow:hidden can't clip me.</p>
        </Modal>
      )}
    </div>
  );
}
```

```jsx
// Event bubbling still follows the REACT tree across a portal, not the DOM tree
function Toolbar() {
  // A click inside the portaled Popup still triggers this handler,
  // because React bubbles synthetic events through the component tree.
  const handleClick = () => console.log('Click bubbled up through React tree');

  return (
    <div onClick={handleClick}>
      <Popup />
    </div>
  );
}

function Popup() {
  const popupRoot = document.getElementById('popup-root');
  return createPortal(
    <button>Click me (physically outside Toolbar's DOM subtree)</button>,
    popupRoot
  );
}
```

```jsx
// Context still flows across a portal boundary, since it follows the component tree
const ThemeContext = React.createContext('light');

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Toolbar /> {/* Popup, rendered via portal, can still read the "dark" theme */}
    </ThemeContext.Provider>
  );
}

function Popup() {
  const theme = useContext(ThemeContext); // "dark" — Context isn't blocked by the portal
  const popupRoot = document.getElementById('popup-root');
  return createPortal(<div className={theme}>Themed popup content</div>, popupRoot);
}
```

## Common Pitfalls / Gotchas

- Forgetting that the target DOM node must exist before `createPortal` is called — a node created dynamically (e.g. `document.createElement('div')` and appended in an effect) needs to actually be in the DOM first, and cleaned up (removed) on unmount if the component created it itself.
- Assuming a portal removes the component from React's tree/lifecycle — it doesn't; the portaled content still mounts, updates, and unmounts in step with its logical position in the component tree, it's purely the DOM insertion point that differs.
- Relying on CSS selectors like `.parent > .child` or DOM-tree-based styling assumptions for portaled content — since the actual DOM structure no longer matches the component structure, DOM-relative CSS (and some DOM-traversal code) needs to account for the physically different location.
- Not stopping event propagation where needed — since synthetic events bubble through the React tree regardless of the portal, a click inside a portaled modal will still trigger an ancestor's `onClick` in the React tree (e.g. a background overlay click-to-close handler) unless you explicitly call `stopPropagation`.
- Server-side rendering portals to a `document` node — `document` doesn't exist during SSR, so portal target lookups need to be guarded to run only on the client (e.g. inside `useEffect`, or with an `isMounted` check) to avoid SSR crashes.

## Interview Questions & Answers

**Q: What is a React portal, and what problem does it solve?**
A: `ReactDOM.createPortal(child, container)` renders a subtree of React elements into a DOM node outside the normal DOM hierarchy of its parent component, while keeping that subtree's logical position in the React component tree unchanged. It solves the problem of needing to visually "escape" a parent's constrained DOM box — most commonly `overflow: hidden`, fixed dimensions, or z-index stacking contexts that would otherwise clip or misposition content like modals, tooltips, and dropdowns.

**Q: If a portaled component's DOM output lives somewhere else entirely, do click events still bubble to its logical parent's handlers?**
A: Yes — React's synthetic event system bubbles events through the component (React) tree, not the raw DOM tree, so an event fired inside a portal still reaches ancestor handlers defined at the portaled component's logical position in the React tree, exactly as if no portal were used.

**Q: Does a portaled component still have access to Context from providers above it in the tree?**
A: Yes, for the same reason event bubbling still works — Context resolution follows the component tree, not the DOM tree, so a portal doesn't cut a subtree off from Context providers that logically wrap it, even though its DOM output is physically rendered elsewhere.

**Q: What's a concrete example of when you'd reach for a portal instead of just rendering normally?**
A: A modal dialog triggered from deep inside a scrollable, `overflow: hidden` panel. Rendered normally, the modal's markup would be clipped or mispositioned by that panel's CSS. Rendering the modal through a portal into a top-level DOM node (a sibling of the app root) lets it render as a proper full-viewport overlay while its open/close state and trigger logic remain owned by the component that's logically responsible for it.

**Q: Does using a portal change how state or props work inside the portaled component?**
A: No — a portal only changes the DOM insertion point for rendered output. Props, state, hooks, Context, and the component's lifecycle all behave exactly as they would if the component weren't portaled at all; only the physical location of the resulting DOM nodes differs.

## Related Topics
- [refs-and-forward-ref.md](./refs-and-forward-ref.md)
- [use-context.md](./use-context.md)
- [handling-events.md](./handling-events.md)
- [error-boundaries.md](./error-boundaries.md)
- [component-lifecycle.md](./component-lifecycle.md)
