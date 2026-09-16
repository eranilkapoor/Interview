# JSX

JSX (JavaScript XML) is a syntax extension for JavaScript that lets you write HTML-like markup directly inside JavaScript code. It isn't a separate templating language and it isn't valid JavaScript on its own — it's syntactic sugar that a compiler (typically Babel, or the TypeScript compiler) transforms into regular JavaScript function calls before the browser ever sees it. Historically, JSX compiled to calls to `React.createElement(type, props, ...children)`, which produces a plain JavaScript object describing an element (its type, props, and children) — not an actual DOM node. Since React 17, the "new JSX transform" changed what the compiler emits under the hood (calls to functions imported automatically from `react/jsx-runtime`, like `jsx()` and `jsxs()`), which is why modern React files no longer require `import React from 'react'` just to use JSX — but conceptually the result is the same: JSX is just a more readable way to write nested calls that build a tree of plain description objects, which React later reads to render and update the actual DOM.

Because JSX compiles down to function calls, anything that's valid as a JavaScript expression can be embedded inside it using curly braces `{}`. This is what makes JSX more powerful than a typical template language: `{}` isn't special templating syntax with its own limited grammar — it drops you back into full JavaScript. You can embed variables, function calls, ternaries, and `.map()` calls for rendering lists, but you cannot embed statements (like `if` or `for`) directly inside `{}`, since expressions and statements are different things in JavaScript; conditional logic has to be expressed via expression-friendly constructs (ternaries, `&&`, or logic pulled out above the `return` and only referenced inside `{}`).

JSX enforces a few rules that trip up newcomers coming from HTML. First, a component must return a *single* root element — you can't return two sibling elements side by side, because under the hood this all compiles to a single function call, and a function can only return one value. When you don't want to add an extra wrapper `<div>` just to satisfy this rule, you use a Fragment (`<>...</>`) instead, which renders nothing extra to the DOM (see [fragments.md](./fragments.md)). Second, JSX attributes are camelCase JavaScript-style property names rather than HTML's lowercase-with-hyphens convention, because they ultimately become JavaScript object keys: `onclick` becomes `onClick`, `tabindex` becomes `tabIndex`, and — most famously — `class` becomes `className`, since `class` is a reserved word in JavaScript. Third, every element must be explicitly closed: void elements like `<img>` or `<input>` that are self-closing in HTML must be written as `<img />` in JSX, with the trailing slash, because JSX is parsed more strictly than HTML.

JSX also differs from HTML in how it treats content for security and correctness. By default, any value you interpolate into JSX via `{}` is automatically escaped before being inserted, which is why React is resistant to XSS injection through ordinary text/attribute interpolation — a string like `<script>alert(1)</script>` embedded via `{userInput}` is rendered as inert text, not parsed as markup. (Bypassing this protection requires the explicitly-named escape hatch, `dangerouslySetInnerHTML`, which signals in its own name that you're opting out of that safety net.) JSX also treats whitespace and comments differently from HTML — comments inside JSX must be written as JavaScript expressions (`{/* comment */}`, not `<!-- comment -->`), and some HTML attributes have no direct DOM equivalent and are renamed accordingly (`for` becomes `htmlFor`, since `for` is also a reserved word).

## Examples

```jsx
// JSX is sugar over function calls — these two are equivalent
function Greeting() {
  return <h1 className="title">Hello, world!</h1>;
}

// Roughly compiles to (classic transform):
// function Greeting() {
//   return React.createElement('h1', { className: 'title' }, 'Hello, world!');
// }
```

```jsx
// Embedding arbitrary JS expressions with {}
function UserGreeting({ user }) {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : 'afternoon';

  return (
    <div>
      <p>Good {timeOfDay}, {user.name}!</p>
      {/* .map() is a plain JS expression, so it works fine inside {} */}
      <ul>
        {user.roles.map((role) => (
          <li key={role}>{role}</li>
        ))}
      </ul>
      {/* an `if` statement would NOT be valid here — use a ternary or && instead */}
      {user.isAdmin && <span>Admin</span>}
    </div>
  );
}
```

```jsx
// Common JSX-vs-HTML differences in one component
function ProfileForm() {
  return (
    <form>
      {/* className, not class */}
      <div className="form-row">
        {/* htmlFor, not for */}
        <label htmlFor="email">Email</label>
        <input id="email" type="email" />{/* self-closing, no <input></input> */}
      </div>
      <img src="/avatar.png" alt="User avatar" />{/* self-closing required */}
    </form>
  );
}
```

## Common Pitfalls / Gotchas

- Trying to put a statement (`if`, `for`, `switch`) directly inside `{}` — only expressions are allowed; conditional rendering has to use ternaries, `&&`, or a variable computed above the `return`.
- Forgetting that a component must return one root node — returning two sibling top-level elements is a compile error unless wrapped in a single parent or a Fragment.
- Using `class` instead of `className` (a leftover HTML habit) — React will silently ignore `class` in terms of styling and often warn about it in the console.
- Forgetting `key` when rendering a list via `.map()` — JSX doesn't require it syntactically, but React needs it for correct reconciliation, and will warn loudly in development if it's missing.
- Assuming falsy JSX expressions render nothing — `{0 && <Foo />}` renders the literal text `0` to the screen, because `0` is a valid, "truthy-enough-to-render" child value in React (see [displaying-data-in-jsx.md](./displaying-data-in-jsx.md)).

## Interview Questions & Answers

**Q: What is JSX, and is it required to use React?**
A: JSX is a syntax extension that lets you write markup inline with JavaScript logic; it's compiled (typically by Babel or the TypeScript compiler) into plain JavaScript function calls that build element description objects. It's not strictly required — you can call `React.createElement()` directly — but JSX is overwhelmingly the standard way to write React because it's far more readable for nested UI trees.

**Q: What does JSX actually compile to?**
A: Historically, calls to `React.createElement(type, props, ...children)`, producing a plain object describing the element. Since React 17's new JSX transform, it compiles instead to calls to functions like `jsx()`/`jsxs()` auto-imported from `react/jsx-runtime`, which is why an explicit `import React from 'react'` is no longer required in every file just to use JSX — but the conceptual output (a tree of element description objects) is the same either way.

**Q: Why does React use `className` instead of `class`, and what are a couple of other HTML-attribute renames?**
A: Because JSX attributes become JavaScript object property names under the hood, and `class` is a reserved word in JavaScript, so it can't be used as an identifier/property name in that context. `for` (on `<label>`) is renamed `htmlFor` for the same reason. Most other attributes just switch from lowercase/hyphenated HTML convention to camelCase (`onclick` → `onClick`, `tabindex` → `tabIndex`).

**Q: Why can a component only return a single root JSX element, and how do you work around it without adding extra DOM nodes?**
A: Because JSX compiles to a single function call/expression, and a function can only return one value — you can't return two sibling elements from one `return` statement. The idiomatic workaround is a Fragment (`<>...</>` or `<React.Fragment>`), which groups multiple children under one syntactic root without adding any extra node to the actual rendered DOM.

**Q: How does JSX protect against XSS by default, and how would you intentionally opt out of that protection?**
A: Any value interpolated into JSX via `{}` is automatically escaped before being rendered, so injecting a string containing `<script>` tags or other markup just renders as inert text rather than being parsed as HTML. The only way to render raw, unescaped HTML is the intentionally scary-named `dangerouslySetInnerHTML` prop, which is a deliberate escape hatch you should only use with content you trust or have sanitized yourself.

## Related Topics
- [components.md](./components.md)
- [fragments.md](./fragments.md)
- [displaying-data-in-jsx.md](./displaying-data-in-jsx.md)
- [rendering-lists-and-keys.md](./rendering-lists-and-keys.md)
- [conditional-rendering.md](./conditional-rendering.md)
- [virtual-dom-and-reconciliation.md](./virtual-dom-and-reconciliation.md)
