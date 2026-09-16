# Adding Styles in React

React doesn't mandate a single way to style components — it's unopinionated about styling the same way it's unopinionated about routing or data fetching, so a React codebase might use any combination of plain CSS files, inline styles, CSS Modules, or a CSS-in-JS library depending on the team's needs. Understanding the trade-offs between these approaches, and specifically how JSX's inline `style` prop differs from regular CSS syntax, is a common interview topic because it touches both JSX mechanics and real-world architecture decisions.

The most direct approach is the inline `style` prop, which JSX treats specially: instead of accepting a CSS string like the HTML `style` attribute does, it expects a JavaScript object whose keys are camelCased CSS property names (`backgroundColor` instead of `background-color`) and whose values are strings or numbers. Numeric values for most length-based properties are automatically treated as pixels (`fontSize: 20` becomes `20px`), though unitless CSS properties like `opacity` or `flexGrow` are left as plain numbers. Inline styles are useful for one-off, dynamically computed values (e.g., a progress bar's width based on a live percentage) but don't support pseudo-classes (`:hover`), media queries, or CSS-file-level features like `@keyframes`, and they don't benefit from a browser's CSS caching/parsing the way an external stylesheet does.

The more conventional approach is writing plain CSS in a separate `.css` file and applying class names via the JSX `className` attribute (not `class`, which is a reserved word in JavaScript — see [jsx.md](./jsx.md)). This keeps full access to the entire CSS language — pseudo-classes, media queries, animations — and is simple to reason about, but plain global CSS class names can collide across a large codebase, since nothing scopes a `.card` class in one file from a differently-intentioned `.card` class in another.

CSS Modules address that collision problem directly: a file named `Card.module.css` is processed by the build tool so that each class name inside it is automatically rewritten to a unique, scoped identifier (e.g., `.card` becomes something like `.Card_card__a1b2c`) at build time, and importing the file gives you a JavaScript object mapping your original class names to their scoped equivalents (`import styles from './Card.module.css'; <div className={styles.card}>`). This gives you real CSS (full language support) with automatic, file-level scoping, without needing a runtime library. A step further is CSS-in-JS libraries like styled-components, which let you define styled components by writing actual CSS inside a JavaScript tagged template literal (`const Button = styled.button\`color: red;\`;`), generating scoped class names at runtime (or build time, depending on the tool) and letting styles receive props directly for dynamic styling — at the cost of adding a runtime dependency and, for some of these libraries, a runtime performance cost for style generation. Which approach to use is largely a team/project decision: inline styles for small dynamic one-offs, plain CSS/CSS Modules for most component styling in small-to-medium projects, and CSS-in-JS or utility frameworks (like Tailwind, a different but related approach not covered here) when a project wants tightly co-located, prop-driven styling logic.

## Examples

```jsx
// Inline styles: a JS object with camelCase keys, useful for dynamic values
function ProgressBar({ percent }) {
  return (
    <div style={{ width: '100%', backgroundColor: '#eee' }}>
      <div
        style={{
          width: `${percent}%`,        // string value
          height: 8,                   // number -> treated as '8px'
          backgroundColor: 'seagreen',
          opacity: percent < 100 ? 1 : 0.6, // unitless property stays a plain number
        }}
      />
    </div>
  );
}
```

```jsx
// Plain CSS file + className
// styles.css:
// .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
// .card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); } // pseudo-classes work fine

import './styles.css';

function Card({ title, children }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
```

```jsx
// CSS Modules: scoped class names, no global collisions
// Card.module.css:
// .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }

import styles from './Card.module.css';

function Card({ title, children }) {
  return (
    <div className={styles.card}> {/* compiled to a unique scoped class name */}
      <h3>{title}</h3>
      {children}
    </div>
  );
}
```

## Common Pitfalls / Gotchas

- Writing `style="color: red;"` (an HTML-style CSS string) instead of `style={{ color: 'red' }}` (a JS object) — the inline `style` prop in JSX always expects an object, never a raw CSS string.
- Forgetting to camelCase CSS property names in inline style objects (`background-color` instead of `backgroundColor`) — React won't apply hyphenated keys correctly since they must be valid JS object property names.
- Expecting inline styles to support pseudo-classes, pseudo-elements, or media queries (`:hover`, `::before`, `@media`) — the `style` prop can't express any of these; you need a real stylesheet, CSS Modules, or a CSS-in-JS library with that capability.
- Using plain global CSS class names in a large codebase without any scoping strategy — unrelated components can accidentally collide on the same class name and silently override each other's styles.
- Forgetting that a numeric value isn't automatically unitless for every CSS property — most length properties default to pixels when given a bare number, but a handful (like `opacity`, `zIndex`, `flex`, `lineHeight`) are unitless by CSS spec and should stay numbers.

## Interview Questions & Answers

**Q: How does the inline `style` prop in JSX differ from the HTML `style` attribute?**
A: In HTML, `style` takes a semicolon-separated CSS string (`style="color: red; font-size: 14px;"`). In JSX, `style` takes a JavaScript object whose keys are camelCased CSS property names and whose values are strings or numbers (`style={{ color: 'red', fontSize: 14 }}`), because it's just a regular prop receiving a regular JS value, not a raw string parsed as CSS.

**Q: What problem do CSS Modules solve compared to plain global CSS files?**
A: Plain CSS class names are global by default — two different files can accidentally define the same class name and unintentionally override each other's styles as the codebase grows. CSS Modules solve this by having the build tool automatically rewrite each class name in a `*.module.css` file into a unique, scoped identifier, so importing the module gives you collision-free class names without changing how you write CSS itself.

**Q: When would you reach for inline styles versus a stylesheet?**
A: Inline styles are appropriate for values that are computed dynamically at render time and are genuinely per-instance — like a progress bar's width tied to a live percentage, or a color computed from data. For styling that's static, reusable, involves pseudo-classes/media queries, or applies broadly across many elements, a stylesheet (plain CSS, CSS Modules, or CSS-in-JS) is the better fit, since inline styles can't express those CSS features at all.

**Q: What is CSS-in-JS, and what's a trade-off of using a library like styled-components?**
A: CSS-in-JS lets you write actual CSS inside JavaScript (often via tagged template literals), co-locating styles tightly with the component and letting styles respond directly to props for dynamic styling without manually toggling class names. The trade-off is an added runtime (or build-time) dependency, and for runtime-based implementations, a performance cost to generate and inject styles that a plain precompiled stylesheet wouldn't incur.

## Related Topics
- [jsx.md](./jsx.md)
- [components.md](./components.md)
- [props.md](./props.md)
- [react-performance-optimization.md](./react-performance-optimization.md)
