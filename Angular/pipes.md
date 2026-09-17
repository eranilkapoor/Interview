# Pipes

A pipe is a class decorated with `@Pipe()` that transforms a value for display directly inside a template, using the `|` syntax: `{{ value | pipeName }}`. Pipes exist to keep templates declarative and components free of formatting/transformation logic — instead of a component method `formatPrice(value)` called imperatively, you write `{{ price | currency:'USD' }}` and the transformation lives next to where it's used, is trivially reusable across components, and is unit-testable in isolation since a pipe's `transform()` method is just a pure function taking a value (and optional arguments) and returning the display value.

Angular ships several built-in pipes: `date` (formats a `Date`/timestamp/ISO string, e.g. `{{ order.createdAt | date:'medium' }}`), `currency` (`{{ price | currency:'EUR':'symbol':'1.2-2' }}`), `decimal`/`percent` for number formatting, `uppercase`/`lowercase`/`titlecase` for string casing, `json` (runs `JSON.stringify` — extremely useful for debugging a template value: `{{ someObject | json }}`), `slice` (works on arrays and strings, similar to `Array.prototype.slice`), and `keyvalue` (iterates the entries of an object or `Map` in a `@for`/`*ngFor`). Pipes can be chained (`{{ name | lowercase | titlecase }}`, evaluated left to right) and take parameters via colon syntax (`{{ amount | currency:'USD':'symbol':'1.0-0' }}` — currency code, display format, digit info).

The pure/impure distinction is the part interviewers probe hardest because it has real performance consequences. By default every pipe is **pure** (`pure: true` is the default), meaning Angular only re-runs `transform()` when the *reference* of its input (or its arguments) changes, not on every change-detection cycle. This is efficient but has a sharp edge: if you pipe an array or object and then mutate it in place (`this.items.push(x)`) rather than replacing it with a new reference (`this.items = [...this.items, x]`), a pure pipe will not re-run, and the view silently goes stale. An **impure pipe** (`@Pipe({ name: 'myPipe', pure: false })`) re-runs `transform()` on *every* change-detection cycle regardless of whether its input changed — Angular's own built-in `AsyncPipe` is impure by necessity, since it needs to check "has a new value arrived from the Observable/Promise since last check" on every tick. Impure pipes are a legitimate escape hatch (e.g., a pipe that needs to reflect mutable array contents), but writing your own impure pipe for anything even moderately expensive is a well-known performance foot-gun, because that transform now runs dozens of times per second under Angular's default change detection.

The `async` pipe deserves special attention because it's one of the most-used pipes in real Angular code and does real lifecycle work, not just formatting. Given `{{ data$ | async }}` where `data$` is an Observable or a Promise, the pipe subscribes to `data$` when the binding is first evaluated, marks the component for check whenever a new value arrives (working correctly even under `ChangeDetectionStrategy.OnPush`), and — critically — automatically unsubscribes when the component/directive hosting the binding is destroyed. This makes `async` the standard, leak-safe way to consume Observables in templates, sidestepping manual `subscribe()`/`unsubscribe()` bookkeeping entirely. It works with both Observables and Promises transparently. As of Angular 17+'s standalone-by-default world, pipes are declared `standalone: true` and imported directly into a component's `imports` array rather than declared in an `NgModule`.

## Examples

```ts
import { Pipe, PipeTransform } from '@angular/core';

// A pure custom pipe: truncates text to a max length and appends an ellipsis.
// Pure (the default) means it only re-runs when `value` or `limit`'s reference/
// primitive value changes — cheap and safe for this kind of stateless transform.
@Pipe({
  name: 'truncate',
  standalone: true,
})
export class TruncatePipe implements PipeTransform {
  transform(value: string | null | undefined, limit = 50, trail = '…'): string {
    if (!value) return '';
    return value.length > limit ? value.slice(0, limit) + trail : value;
  }
}
```

```html
<!-- Usage: parameterized and chained pipes -->
<p>{{ article.summary | truncate:120 }}</p>
<p>{{ user.name | lowercase | titlecase }}</p>
<p>{{ order.total | currency:'USD':'symbol':'1.2-2' }}</p>
<p>{{ order.placedAt | date:'MMM d, y, h:mm a' }}</p>
```

This shows chaining (`lowercase` then `titlecase`) and parameterization (`currency` and `date` both take colon-separated arguments) — both evaluated left to right, each pipe receiving the previous one's output.

```ts
import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-live-price',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <!-- 'as' aliases the resolved value so we only subscribe ONCE, not once
         per interpolation — subscribing twice would fire the HTTP call twice. -->
    @if (price$ | async; as price) {
      <span>{{ price | currency }}</span>
    } @else {
      <span>Loading…</span>
    }
  `,
})
export class LivePriceComponent {
  private http = inject(HttpClient);
  price$ = this.http.get<number>('/api/price');
}
```

The `async` pipe subscribes when the template first evaluates the expression and unsubscribes automatically on component destruction — no `ngOnDestroy` cleanup required, and it plays correctly with `OnPush` change detection because it explicitly marks the component dirty on each new emission.

## Common Pitfalls / Gotchas

- Mutating an array/object in place (`this.list.push(item)`) that's bound through a pure pipe (e.g., a custom `filter` or `sort` pipe) — the pipe won't re-run because the reference didn't change; you must replace the reference (`this.list = [...this.list, item]`) for a pure pipe to detect the change.
- Writing a custom filtering/sorting pipe and marking it impure to "just make it work" — impure pipes run on every single change-detection cycle app-wide, which can tank performance if the transform does anything non-trivial (sorting, filtering large arrays, formatting many items in a list).
- Calling `| async` on the same source multiple times in one template — each occurrence is an independent subscription, so a cold Observable (like an `HttpClient` call) fires once per usage; alias it with `as` (or `@if (obs$ | async; as value)`) to subscribe once and reuse the value.
- Using the `date` pipe on a raw string/number without confirming the format Angular expects — it parses ISO 8601 strings, epoch millisecond numbers, and `Date` objects, but arbitrary non-ISO date strings can produce `Invalid Date` silently.
- Forgetting that `json` pipe output is meant for debugging, not user-facing display — it dumps the raw JSON structure including internal fields, which is rarely what you want to actually ship.
- Applying a pipe inside a hot loop over a large list without `trackBy`/`track` — combined with an impure pipe or object mutation, this can cause every item's pipe to re-run on every keystroke elsewhere in the component, not just when the list itself changes.

## Interview Questions & Answers

**Q: What's the difference between a pure and an impure pipe, and when would you make one impure?**
A: A pure pipe (the default) only re-executes `transform()` when Angular's change detection sees that the input reference (for objects/arrays) or primitive value has changed, which is cheap because it's a simple reference/value comparison. An impure pipe re-executes on every change-detection cycle regardless of whether the input changed. You'd mark a pipe impure only when it needs to reflect internal mutations to an object/array that don't change its reference — Angular's own `AsyncPipe` is impure because it must poll "has the Observable emitted since I last checked" on each cycle. For anything computationally non-trivial, impurity is usually a performance mistake; prefer keeping data immutable so a pure pipe re-runs correctly instead.

**Q: How does the `async` pipe handle subscription and unsubscription, and why does that matter?**
A: It subscribes to the Observable (or resolves the Promise) the first time the template evaluates the bound expression, and it automatically unsubscribes when the component or directive that owns the binding is destroyed. This matters because it eliminates an entire class of memory leaks that come from manually subscribing in a component class and forgetting to unsubscribe in `ngOnDestroy`. It also correctly triggers change detection for `OnPush` components on each new emission, which a manual `subscribe()` assigning to a plain field would not do by itself.

**Q: Why would `{{ items | myFilterPipe }}` stop updating after you call `items.push(newItem)`?**
A: Because the pipe is pure by default, and pure pipes compare the input by reference (and primitives by value) between change-detection runs. `push()` mutates the existing array in place, so the reference passed to the pipe is unchanged, and Angular's pure-pipe memoization skips re-invoking `transform()`. The fix is to treat the array as immutable and assign a new reference, e.g. `this.items = [...this.items, newItem]`, which pure-pipe comparison will detect as changed.

**Q: How do you write and register a custom pipe in a standalone Angular application?**
A: Decorate a class with `@Pipe({ name: 'myPipe', standalone: true })` and implement `PipeTransform`'s `transform(value, ...args)` method, which must be a pure function that returns the transformed value without causing side effects. To use it, import the pipe class directly into the `imports` array of any standalone component that references it in its template — there's no `NgModule` `declarations` array involved in the standalone workflow.

**Q: Can pipes take multiple parameters, and how is that syntax structured?**
A: Yes — each colon after the pipe name supplies one additional argument to `transform()`, in order. For example `{{ amount | currency:'USD':'symbol':'1.2-2' }}` calls `CurrencyPipe.transform(amount, 'USD', 'symbol', '1.2-2')`, where the parameters are currency code, display format, and digit-info string respectively. A custom pipe reads these the same way: `transform(value: string, limit: number, trail: string)`.

## Related Topics

- [observables.md](./observables.md)
- [interpolation.md](./interpolation.md)
- [data-binding.md](./data-binding.md)
- [directives.md](./directives.md)
- [templates.md](./templates.md)
