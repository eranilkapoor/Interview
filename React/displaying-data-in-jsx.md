# Displaying Data in JSX

JSX lets you display dynamic data by embedding JavaScript expressions directly inside the markup using curly braces `{}`. Anywhere you'd normally write static text or a static attribute value in HTML, you can instead drop in `{someExpression}`, and React evaluates that expression at render time and inserts the result — a string, number, array of elements, or another React element — into the output. This works identically whether you're interpolating into text content (`<p>Hello, {name}</p>`) or into an attribute value (`<img src={user.avatarUrl} />`), which is a deliberate unification: JSX doesn't have two different interpolation syntaxes for "text" versus "attributes" the way some template languages do — it's always just a JavaScript expression inside `{}`.

Because `{}` accepts *any* expression, displaying data in JSX is really just normal JavaScript: you read values off objects and arrays, call functions, use template literals, and apply array methods like `.map()` to turn a data array into a list of elements. This is fundamentally different from string-based templating, where the template engine parses a special mini-language with its own limited feature set — JSX has no separate "template language" to learn beyond the rule that only expressions (not statements) are allowed inside `{}`.

React's default text/attribute interpolation is automatically HTML-escaped, which is an important safety property: if `name` came from user input and happened to contain `<img src=x onerror=alert(1)>`, embedding it via `{name}` renders that string as inert, escaped text on the page rather than parsing it as markup — this is what gives JSX its default resistance to XSS through ordinary interpolation. This protection only applies to values passed through `{}` normally; it's deliberately bypassed only by the aptly-named `dangerouslySetInnerHTML` prop, which should be reserved for content you've already sanitized or fully trust.

One recurring gotcha deserves special attention: not every "falsy" JavaScript value is treated the same way when used as a JSX child. `false`, `null`, `undefined`, and `true` all render as nothing when they appear as a child expression — this is intentional, since it's exactly what lets patterns like `{condition && <Component />}` work as conditional rendering (when `condition` is `false`, nothing renders). But `0` is a real, meaningful number that React renders as the text "0" — it does not get the same "render nothing" treatment as the other falsy values. This means a seemingly innocent conditional like `{items.length && <List items={items} />}` will render a stray "0" on the page whenever `items.length` is `0`, because `0 && anything` evaluates to `0`, and `0` is not treated as "nothing" by JSX.

## Examples

```jsx
// Interpolating expressions into text content and into attributes
function ProductCard({ product }) {
  return (
    <div className={`card ${product.inStock ? 'in-stock' : 'out-of-stock'}`}>
      <img src={product.imageUrl} alt={product.name} />
      <h3>{product.name}</h3>
      <p>${product.price.toFixed(2)}</p>
    </div>
  );
}
```

```jsx
// Rendering a list from an array of data via .map()
function TagList({ tags }) {
  return (
    <ul>
      {tags.map((tag) => (
        <li key={tag.id}>#{tag.label}</li>
      ))}
    </ul>
  );
}
```

```jsx
// The falsy-value rendering gotcha: 0 is NOT treated like false/null/undefined
function CartSummary({ items }) {
  return (
    <div>
      {/* BUG: if items.length is 0, this renders a literal "0" on the page,
          because 0 && <List/> evaluates to 0, and JSX renders 0 as text */}
      {items.length && <List items={items} />}

      {/* FIX: force a real boolean, or use a ternary with an explicit "nothing" branch */}
      {items.length > 0 && <List items={items} />}
      {items.length > 0 ? <List items={items} /> : null}
    </div>
  );
}
```

## Common Pitfalls / Gotchas

- `{condition && <Component />}` renders a stray `0` when `condition` is the number `0` rather than a boolean — always coerce to a real boolean (`items.length > 0 && ...`) when the left side of `&&` might be a number.
- Trying to put statements (`if`, `for`) inside `{}` — only expressions are valid; use ternaries, `&&`, `||`, or precompute a value above the `return` instead.
- Forgetting that objects can't be rendered directly as JSX children — `{someObject}` throws a runtime error ("Objects are not valid as a React child"); you must render specific fields or a stringified form instead.
- Assuming `{}` interpolation protects against every kind of injection — it protects against HTML/script injection via auto-escaping, but it doesn't sanitize values used elsewhere unsafely, like a raw URL passed to `href` that could still be a `javascript:` URI.
- Relying on `dangerouslySetInnerHTML` for convenience rather than necessity — it explicitly disables JSX's default escaping/XSS protection and should only be used with trusted or already-sanitized HTML.

## Interview Questions & Answers

**Q: How do you embed dynamic data inside JSX?**
A: With curly braces `{}`, which can wrap any valid JavaScript expression — a variable, a function call, a ternary, an array `.map()` call, a template literal, and so on. This works the same way whether you're interpolating into element text content or into an attribute value; JSX doesn't distinguish those cases syntactically.

**Q: Why does `{0 && <Component />}` render `0` on the screen instead of nothing?**
A: Because `&&` returns whichever operand short-circuited the expression, and `0 && anything` evaluates to `0`, not to `false`. React only skips rendering for the specific values `false`, `null`, `undefined`, and `true` when they appear as a JSX child — `0` is a legitimate renderable value (the text "0"), so it gets rendered as-is. The fix is to ensure the condition is coerced to an actual boolean first.

**Q: Does JSX protect against XSS automatically?**
A: Yes, for the default case — any value interpolated via `{}` into text content or attributes is automatically HTML-escaped before insertion, so injected markup/script strings render as inert text rather than being parsed as HTML. This protection is intentionally bypassed only by `dangerouslySetInnerHTML`, whose name signals that you're opting out of the default safety behavior and are responsible for ensuring the HTML you pass is safe.

**Q: Can you render an array or an object directly as a JSX child?**
A: An array of valid React children (strings, numbers, elements) renders fine — React iterates it and renders each item (though each item generally needs a `key` if they're elements). A plain object does not render directly and throws a runtime error, since React doesn't know how to convert an arbitrary object into displayable output; you need to explicitly pull out and render specific fields, or convert it to a string yourself.

**Q: What's the difference between using a template literal inside `{}` versus JSX's own interpolation?**
A: There isn't a real distinction — a template literal is just one more kind of JavaScript expression, so `` {`Hello, ${name}`} `` is simply an expression evaluated and inserted the same way `{name}` alone would be. JSX doesn't have a separate string-interpolation mechanism; everything funnels through the same `{expression}` rule.

## Related Topics
- [jsx.md](./jsx.md)
- [conditional-rendering.md](./conditional-rendering.md)
- [rendering-lists-and-keys.md](./rendering-lists-and-keys.md)
- [props.md](./props.md)
- [adding-styles-in-react.md](./adding-styles-in-react.md)
