# Interpolation

Interpolation is the `{{ expression }}` syntax used inside a template to render a component-class value as text. It is one-way, component-to-view binding, and syntactically it's the most familiar and approachable binding form because it resembles simple string templating — but underneath it isn't string concatenation at all. Angular's template compiler treats `{{ expression }}` as sugar for a property binding to the element's `textContent` (or, when interpolation appears inside an attribute string like `title="{{ label }}"`, sugar for a property binding to that attribute's corresponding property, with the surrounding literal text concatenated in). This is why interpolation and property binding are described as two syntaxes for fundamentally the same underlying mechanism, not two unrelated features.

The expression inside `{{ }}` is not arbitrary JavaScript — Angular restricts it to a small subset intentionally called "template expression" syntax. You can read properties and call methods on the component (`{{ user.name }}`, `{{ getTotal() }}`), use most operators (`+`, `?:`, `??`), and use the safe-navigation operator `?.` (`{{ user?.address?.city }}`) to guard against `null`/`undefined` without throwing. What you *cannot* do is anything with side effects or that resembles a statement rather than an expression: no assignments (`{{ x = 5 }}`), no `new`, no increment/decrement (`++`/`--`), no bitwise `|`/`&` (the `|` character is reserved for pipes instead), and no chained statements with `;`. This restriction exists deliberately — templates are meant to *read* the model, not mutate it, which keeps change detection predictable, since Angular may re-evaluate a template expression multiple times per change-detection cycle and a side-effecting expression could produce different results on each evaluation or corrupt state.

Interpolation auto-escapes its output. Whatever the expression evaluates to is inserted as text (via `textContent`-equivalent binding), so HTML metacharacters like `<`, `>`, and `&` are rendered literally rather than parsed as markup — this is Angular's default XSS defense for interpolated content. If a value actually needs to be rendered as HTML markup, you have to opt in explicitly via `[innerHTML]` property binding, which Angular sanitizes through its built-in `DomSanitizer` before insertion (stripping dangerous constructs like `<script>` tags or `on*` event handler attributes), unless you deliberately bypass sanitization with `bypassSecurityTrustHtml`. Interpolation gives you none of that risk surface because it never parses its output as markup in the first place.

Pipes work inside interpolation using the `|` syntax, e.g. `{{ price | currency:'USD' }}` or `{{ createdAt | date:'short' }}` — the pipe transforms the expression's value before it's rendered as text, and multiple pipes can be chained (`{{ name | uppercase | slice:0:10 }}`). This is extremely common in real templates because it lets you keep formatting logic (currency, dates, casing, truncation) out of the component class and declared right where the value is displayed. See [pipes.md](./pipes.md) for how pipes are defined and how pure vs impure pipes affect change detection.

## Examples

```ts
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-order-summary',
  standalone: true,
  template: `
    <!-- Basic interpolation of a signal and a method call -->
    <h3>Order #{{ orderId }}</h3>
    <p>Placed by {{ customer()?.fullName ?? 'Guest' }}</p>

    <!-- Interpolation with a pipe chain for formatting -->
    <p>Total: {{ total() | currency:'USD':'symbol':'1.2-2' }}</p>

    <!-- Interpolation calling a method -->
    <p>Status: {{ describeStatus() }}</p>
  `,
})
export class OrderSummaryComponent {
  orderId = 'A-1042';
  customer = signal<{ fullName: string } | null>(null); // safe-navigation avoids a crash here
  total = signal(129.995);

  describeStatus() {
    return this.total() > 100 ? 'Priority' : 'Standard';
  }
}
```

This demonstrates the safe-navigation operator guarding a possibly-null value, a pipe chain formatting currency, and a method call — all valid inside `{{ }}` because they're pure reads, not statements.

```ts
// What interpolation auto-escapes vs. what [innerHTML] requires sanitization for
@Component({
  selector: 'app-comment',
  standalone: true,
  template: `
    <!-- Renders literally as text: <b>bold</b> shows up as the literal characters -->
    <p>{{ userSuppliedText }}</p>

    <!-- Renders as actual markup, but passes through DomSanitizer first -->
    <p [innerHTML]="userSuppliedHtml"></p>
  `,
})
export class CommentComponent {
  userSuppliedText = '<b>bold</b>'; // interpolated -> shows literally, no XSS risk
  userSuppliedHtml = '<b>bold</b><script>alert(1)</script>'; // sanitized -> script stripped
}
```

This is the core XSS-safety contrast: interpolation never interprets its value as HTML, so it's inherently safe for untrusted text, while `[innerHTML]` does parse it as markup and therefore needs Angular's sanitizer (which strips the `<script>` tag automatically here).

```html
<!-- Illegal inside {{ }} — these would fail to compile / throw a template parse error -->
<!-- {{ x = 5 }}          assignment, not an expression -->
<!-- {{ new Date() }}     `new` is disallowed -->
<!-- {{ doA(); doB() }}   chained statements with `;` are disallowed -->

<!-- Legal: reads, method calls, ternaries, nullish coalescing, safe navigation -->
<p>{{ items.length ? 'Has items' : 'Empty' }}</p>
<p>{{ config?.settings?.theme ?? 'default' }}</p>
```

This contrasts what the template expression grammar accepts versus rejects — a frequent point of confusion for people coming from the assumption that `{{ }}` accepts arbitrary JavaScript.

## Common Pitfalls / Gotchas

- Assuming interpolation can run arbitrary JavaScript statements — assignments, `new`, `++`/`--`, and chained `;` statements all fail to parse; only expression-like reads are allowed.
- Forgetting that interpolation is re-evaluated on every change-detection run, so an expensive method call inside `{{ }}` (e.g. `{{ computeExpensiveTotal() }}`) re-executes far more often than you'd expect — prefer a `computed()` signal or a memoized getter, or move the computation to the component and expose it as a plain property.
- Thinking `{{ }}` can render HTML — it can't; it always renders as literal text. Reaching for `[innerHTML]` "because interpolation didn't render my markup" is the natural next step, but that reintroduces an XSS surface that has to be reasoned about (sanitization, trusted values) that pure interpolation never has.
- Confusing interpolation's implicit `textContent` binding with attribute-position interpolation (`title="{{ x }}"`) — the latter is really a property binding on `title` with string concatenation, not a special case, but it's easy to think of it as "a different kind of interpolation."
- Using `|` inside an interpolation expression expecting bitwise OR — it's always parsed as the start of a pipe, so `{{ a | b }}` looks for a pipe named `b`, not a bitwise-or of `a` and `b`.

## Interview Questions & Answers

**Q: What exactly does `{{ expression }}` compile down to under the hood?**
A: It's sugar for a property binding, typically to the element's `textContent` (or, in an attribute-position string, to that attribute's underlying property with the surrounding literal characters concatenated in). Angular's Ivy compiler turns it into an interpolation instruction that reads the expression's value, coerces it to a string, and sets it directly via DOM APIs — it isn't string templating at the JavaScript level.

**Q: Why can't you write `{{ x = 5 }}` or `{{ new Foo() }}` inside interpolation?**
A: Angular's template expression grammar deliberately excludes assignments, `new`, increment/decrement operators, and statement chaining with `;`. Templates are meant to read the model and render it, not mutate state as a side effect of rendering — allowing side-effecting expressions would make change detection unpredictable, since Angular can re-evaluate the same expression multiple times in a single detection pass, and a side effect firing multiple times (or firing during rendering at all) breaks the assumption that rendering is idempotent.

**Q: Is interpolation vulnerable to XSS the way `innerHTML` is?**
A: No. Interpolation always renders its result as plain text via a `textContent`-equivalent binding — it never parses the value as HTML, so markup characters like `<script>` show up as literal text rather than executing. `[innerHTML]`, by contrast, does parse its value as markup, so Angular runs it through `DomSanitizer` first (stripping dangerous elements/attributes) unless you explicitly bypass sanitization, which is the actual risk surface.

**Q: Can you use the safe-navigation operator and pipes together inside the same interpolation?**
A: Yes — `{{ user?.profile?.bio | slice:0:50 }}` is valid. The safe-navigation operator (`?.`) short-circuits to `undefined` if any link in the chain is `null`/`undefined`, avoiding a runtime error, and the result (whatever it ends up being) is then passed through the pipe as usual.

**Q: If interpolation is "just" a property binding, why does Angular offer both syntaxes instead of just `[ ]`?**
A: Ergonomics and readability for the overwhelmingly common case of rendering text — `<p>{{ name }}</p>` reads far more naturally than `<p [textContent]="name"></p>`, and interpolation also composes naturally with surrounding literal text (`<p>Hello, {{ name }}!</p>`) in a way that a single property binding to the whole node's content couldn't express as cleanly.

## Related Topics

- [property-binding.md](./property-binding.md)
- [data-binding.md](./data-binding.md)
- [pipes.md](./pipes.md)
- [templates.md](./templates.md)
- [attribute-binding.md](./attribute-binding.md)
