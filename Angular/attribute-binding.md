# Attribute Binding

Attribute binding uses `[attr.name]="expression"` syntax to set an HTML *attribute* directly, bypassing the property system entirely. It exists specifically for the cases where property binding — Angular's default and preferred mechanism, see [property-binding.md](./property-binding.md) — cannot be used, because there is no corresponding DOM element property for Angular to set. Property binding only works when the target is a real JavaScript property on the element object; a meaningful chunk of HTML/SVG/ARIA attributes have no such property counterpart, and for those, `[attr.x]` is the only binding mechanism that works.

The canonical examples are `colspan`/`rowspan` on table cells, ARIA attributes (`aria-label`, `aria-hidden`, `aria-describedby`, etc.), SVG-specific attributes (`viewBox`, `stroke-width`, `cx`, `cy`), and `data-*` custom attributes. If you try `[colspan]="n"` on a `<td>`, Angular's template compiler throws a compile-time error — something like "Can't bind to 'colspan' since it isn't a known property of 'td'" — because `HTMLTableCellElement` has no `colspan` JS property in the sense Angular's binding system looks for (it's exposed as `colSpan`, camelCased, which is actually its own separate gotcha — see below). ARIA attributes are a clearer case: `aria-label` has no DOM property equivalent at all; it only ever exists as an attribute, so `[aria-label]="label"` fails outright and `[attr.aria-label]="label"` is the only correct form.

The mechanical difference in behavior, beyond just "which one compiles," is what happens when the bound expression is `null` or `undefined`. Attribute binding removes the attribute from the DOM entirely when the expression evaluates to `null` (this is how you conditionally toggle attributes like `[attr.disabled]="isDisabled ? '' : null"` or, more commonly, `[attr.aria-hidden]="isCollapsed ? 'true' : null"`), whereas property binding just sets the JS property to whatever value the expression produces, `null` included, which for many properties means something different (or is simply invalid, since not all properties accept `null`). This makes `[attr.x]` genuinely useful even in some cases where a property *does* technically exist, if you specifically want the "remove attribute entirely vs. set to falsy" semantics — though that's a secondary use case compared to its primary role of covering properties that don't exist.

`class` and `style` get their own dedicated attribute-binding-adjacent syntaxes — `[class.foo]`, `[style.width]` — rather than requiring `[attr.class]`/`[attr.style]` for the common cases, because they're common enough and structured enough (multi-valued, mergeable) to warrant first-class binding forms. See [class-binding.md](./class-binding.md) and [style-binding.md](./style-binding.md) for those. Plain `[attr.class]="expr"` still works as a fallback (it just sets the whole `class` attribute string, overwriting rather than merging), but it's rarely the right tool once `[class.x]`/`[ngClass]` exist.

## Examples

```html
<!-- colspan has no DOM property Angular's binder recognizes by that name -->
<table>
  <tr>
    <td [attr.colspan]="mergedColumnCount">Merged cell</td>
  </tr>
</table>
```

`colspan` only exists as an attribute in the way `[prop]` binding expects (the actual DOM property is camelCased `colSpan`), so `[attr.colspan]` is the reliable, idiomatic way to bind it — using `[colspan]` throws a compile error.

```ts
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-accordion-panel',
  standalone: true,
  template: `
    <button
      [attr.aria-expanded]="isOpen()"
      [attr.aria-controls]="panelId"
      (click)="isOpen.set(!isOpen())">
      Toggle
    </button>
    <div [id]="panelId" [attr.aria-hidden]="isOpen() ? null : 'true'">
      Panel content
    </div>
  `,
})
export class AccordionPanelComponent {
  isOpen = signal(false);
  panelId = 'panel-1';
}
```

ARIA attributes have no DOM property equivalents at all, so attribute binding is the only option for accessibility state like `aria-expanded`/`aria-controls`/`aria-hidden`; note `[attr.aria-hidden]` set to `null` removes the attribute entirely rather than leaving a stray `aria-hidden="null"` string in the DOM, which is exactly the behavior you want here.

```html
<!-- SVG attributes: also no matching DOM properties in the way Angular's binder expects -->
<svg [attr.viewBox]="'0 0 ' + width + ' ' + height">
  <circle [attr.cx]="centerX" [attr.cy]="centerY" [attr.r]="radius" />
</svg>

<!-- data-* custom attributes, e.g. for e2e test hooks or CSS attribute selectors -->
<div [attr.data-testid]="'user-row-' + user.id"></div>
```

SVG elements largely don't expose their presentation attributes as camelCased JS properties the way HTML elements do, and `data-*` attributes are attributes by definition (accessible via `dataset` as a property, but not individually as `element.testid`), so both categories rely on `[attr.x]` rather than `[x]`.

## Common Pitfalls / Gotchas

- Trying `[colspan]` instead of `[attr.colspan]` — the DOM property is actually named `colSpan` (camelCase), and Angular's property binder looks it up case-sensitively against known element properties, so neither `[colspan]` nor even `[colSpan]` reliably works the way people expect for consistent cross-browser behavior; `[attr.colspan]` sidesteps the whole casing issue.
- Forgetting that setting an attribute binding to `undefined` behaves the same as `null` (attribute removed), but setting it to the string `'false'` does *not* remove it — for boolean-ish attributes like `aria-hidden`, `[attr.aria-hidden]="isOpen"` where `isOpen` is a real boolean will stringify to the attribute value `"true"`/`"false"`, both of which are present-and-truthy from a pure-HTML-attribute-presence perspective (though ARIA attributes are read by their string value, not by presence, so this specific case is fine — it's a much bigger trap for plain boolean HTML attributes, which is why those should use property binding, not attribute binding, in the first place).
- Using `[attr.class]` or `[attr.style]` instead of the dedicated `[class.x]`/`[ngClass]`/`[style.x]`/`[ngStyle]` forms — `[attr.class]` overwrites the entire class attribute string rather than merging with statically-declared classes or other class bindings, which is rarely what you want.
- Reaching for `[attr.x]` out of habit for something that *does* have a real DOM property (e.g. `[attr.value]` instead of `[value]` on an input) — this bypasses Angular's property-based change detection semantics for that value and can produce subtly different behavior (e.g. not reflecting live user input the way the `value` property does).
- Assuming `data-*` attributes need `[attr.data-x]` for every access — reading them back out is usually done via the element's `dataset` property (`element.dataset.testid`), but *writing* them from a template still requires `[attr.data-x]` since `dataset` itself isn't something Angular's property binder targets directly by that dashed name.

## Interview Questions & Answers

**Q: When do you need attribute binding instead of property binding?**
A: Whenever there's no corresponding DOM property for Angular to bind to — the canonical examples are `colspan`/`rowspan` on table cells, ARIA attributes like `aria-label`/`aria-expanded`, SVG presentation attributes like `viewBox`/`cx`/`cy`, and `data-*` custom attributes. Property binding requires a real JS property target; when none exists, `[attr.name]="expr"` sets the HTML attribute directly instead.

**Q: Why does `[colspan]="n"` fail to compile on a `<td>`?**
A: Because Angular's property binder only recognizes real DOM element properties, and the actual JS property for that attribute is camelCased `colSpan`, not `colspan` — and even accounting for casing, Angular's binder specifically doesn't treat it as a bindable property in this context, so it throws a template parse error telling you it's not a known property. `[attr.colspan]="n"` sidesteps this entirely by writing the attribute directly.

**Q: What happens to the DOM when an attribute binding's expression evaluates to `null`, and why is that useful?**
A: The attribute is removed from the element entirely, rather than being set to the string `"null"`. This is useful for conditionally toggling an attribute's presence — e.g. `[attr.aria-hidden]="isVisible ? null : 'true'"` removes `aria-hidden` when the element is visible and adds it with value `"true"` when it's not, which is the correct way to represent that state for assistive technology (rather than leaving `aria-hidden="false"` present, which some screen readers still treat inconsistently).

**Q: Why do ARIA attributes specifically require attribute binding rather than property binding?**
A: ARIA attributes were designed purely as HTML attributes for the accessibility tree — there was never a corresponding DOM element property added for most of them (unlike, say, `disabled` or `checked`, which do have property counterparts). Since Angular's `[x]` property binding syntax only works against real JS properties, and none exist for `aria-*`, `[attr.aria-x]` is the only mechanism that can set them from a template.

**Q: Is `[attr.class]="someString"` a reasonable way to do class binding?**
A: It works mechanically but it's the wrong tool — it overwrites the entire `class` attribute string on every change-detection cycle, clobbering any statically-declared classes in the template and not merging with other class-related bindings. The dedicated `[class.foo]="cond"` for single toggled classes, or `[ngClass]`/`[class]="expr"` for a whole set driven by an object/array, are purpose-built for this and merge correctly instead of overwriting.

## Related Topics

- [property-binding.md](./property-binding.md)
- [class-binding.md](./class-binding.md)
- [style-binding.md](./style-binding.md)
- [data-binding.md](./data-binding.md)
- [directives.md](./directives.md)
