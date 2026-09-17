# Style Binding

Style binding is Angular's dedicated syntax for setting inline CSS styles directly on an element from the template, and like class binding it comes in a single-property form and a multi-property form. `[style.width]="expression"` sets one specific inline CSS property — here, `width` — to whatever the expression evaluates to. `[style]="expression"` (or the older `[ngStyle]="expression"` directive, functionally equivalent and still common in existing code) binds a whole object map of CSS property names to values in one go, e.g. `[style]="{ width: '200px', backgroundColor: activeColor }"`, letting several inline styles be driven from one binding.

The feature people most often forget exists is the **unit-suffix syntax**: `[style.width.px]="widthValue"`, `[style.opacity.%]="percentValue"`, `[style.fontSize.em]="sizeValue"`. When you append `.px`, `.%`, `.em`, or another CSS unit after the property name, Angular automatically appends that unit string to the numeric expression value before setting the style, so `[style.width.px]="150"` produces `width: 150px` without you having to template-string-concatenate `'150px'` yourself in the component or the template. This matters because plain `[style.width]="widthValue"` requires `widthValue` to already be a valid CSS value string (e.g. `'150px'`); if `widthValue` is just the number `150`, the browser silently ignores an invalid unit-less length like `width: 150` for most properties (a small number of properties like `line-height`, `z-index`, `opacity`, and `flex-grow` are unitless by spec and don't need a suffix, which is itself a common source of confusion about when a unit is even required).

Style binding, like class binding, differs from raw attribute binding (`[attr.style]="expr"`) in that it targets individual style properties (or, for the object-map form, merges a set of them) rather than overwriting the entire `style` attribute string as one blob — using `[style.x]` for a single property means other inline styles set elsewhere (statically, or via other bindings) aren't clobbered. `[style]="{...}"`/`[ngStyle]` merges its object's properties with the element's other style declarations the same way `[class]`/`[ngClass]` merges classes, rather than replacing the whole `style` attribute.

One important practical difference from class binding: CSS custom properties (`--my-var`) and camelCase-vs-kebab-case property names both work with style binding — `[style.background-color]` and `[style.backgroundColor]` are both accepted, since Angular normalizes the property name — but this is Angular-specific convenience, not something that generalizes to attribute binding, which is case-sensitive and doesn't do this kind of normalization.

## Examples

```ts
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  template: `
    <!-- Unit-suffix form: Angular appends "%" automatically -->
    <div class="track">
      <div class="fill" [style.width.%]="progress()"></div>
    </div>

    <!-- Single style property without a unit suffix, so the value must already include one -->
    <p [style.color]="statusColor()">{{ label() }}</p>
  `,
})
export class ProgressBarComponent {
  progress = signal(42); // becomes "42%" automatically thanks to .%
  statusColor = signal('#2e7d32'); // must be a full CSS color value already
  label = signal('On track');
}
```

`[style.width.%]="progress()"` demonstrates the unit-suffix feature directly — `progress()` is just the number `42`, and Angular turns it into `width: 42%` in the rendered inline style without any manual string concatenation.

```ts
// Multiple style properties via the object-map form
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-alert-box',
  standalone: true,
  template: `
    <div [style]="alertStyles()">{{ message() }}</div>
  `,
})
export class AlertBoxComponent {
  severity = signal<'info' | 'warning' | 'error'>('warning');
  message = signal('Disk usage is high');

  alertStyles() {
    const colors = { info: '#1976d2', warning: '#f57c00', error: '#d32f2f' };
    return {
      'border-left': `4px solid ${colors[this.severity()]}`,
      padding: '12px',
      'background-color': `${colors[this.severity()]}1a`, // hex + alpha
    };
  }
}
```

The object-map form drives three inline styles from a single method call, and mixes kebab-case (`border-left`, `background-color`) keys freely — both kebab-case and camelCase keys are accepted in the object map, unlike plain JS object property naming conventions which would push you toward camelCase only.

```ts
// px unit suffix and unitless properties side by side
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <img
      [style.width.px]="size()"
      [style.height.px]="size()"
      [style.opacity]="isLoaded() ? 1 : 0.3"
    />
  `,
})
export class AvatarComponent {
  size = 48; // plain number; .px suffix appends the unit for us
  isLoaded = () => true; // opacity is unitless by CSS spec, no suffix needed or valid
}
```

This contrasts a property that needs a unit suffix to be valid CSS (`width`/`height`, which are meaningless as bare numbers) against one that's unitless by specification (`opacity`, where adding `.px` would actually be wrong).

## Common Pitfalls / Gotchas

- Forgetting the unit-suffix syntax exists at all and manually string-concatenating units in the component (`width: this.w + 'px'`) instead of just writing `[style.width.px]="w"` — not wrong, but more verbose and pushes formatting logic out of the template unnecessarily.
- Passing a bare number to `[style.width]` (no suffix) expecting Angular to infer pixels — it won't; without `.px` (or another unit) in the binding target, the value must already be a complete valid CSS string like `'150px'`, or the browser silently drops the invalid unitless length.
- Adding a unit suffix to a property that's unitless by CSS spec (`[style.opacity.px]` or `[style.zIndex.px]`) — this produces an invalid style value that the browser ignores, since `opacity`/`z-index`/`line-height`/`flex-grow` etc. don't take units at all.
- Using `[attr.style]="expr"` instead of `[style]`/`[style.x]` — like `[attr.class]`, this overwrites the entire `style` attribute string rather than merging individual properties, silently wiping out any other statically-declared or separately-bound inline styles.
- Forgetting `NgStyle` needs an explicit `imports: [NgStyle]` in a standalone component (from `@angular/common`) — easy to miss coming from NgModule-based apps where `CommonModule` was often already globally available.
- Reaching for inline style bindings for things that would be better expressed as conditional CSS classes tied to stylesheet rules — style bindings are appropriate for genuinely dynamic, computed values (a progress percentage, a drag offset), but using them for what's really a fixed set of visual states (e.g. "error" vs "success" styling) usually means `[class.x]` plus real CSS is more maintainable and themeable.

## Interview Questions & Answers

**Q: What does the unit-suffix syntax `[style.width.px]="value"` do, and why is it useful?**
A: It tells Angular to append the unit `px` to the numeric expression's value before setting the inline style, producing e.g. `width: 150px` from a plain number `150`. It's useful because many CSS properties (`width`, `height`, `margin`, `font-size`, etc.) are invalid as bare unitless numbers, so without the suffix you'd have to manually string-concatenate the unit in the component class or the template expression every time; the suffix lets the component just expose a plain number and lets the template own the unit.

**Q: What's the difference between `[style.width]="w"` and `[style.width.px]="w"`?**
A: `[style.width]="w"` expects `w` to already be a complete, valid CSS value string, e.g. `'150px'` or `'50%'` — Angular sets it verbatim. `[style.width.px]="w"` expects `w` to be a plain number (or numeric string) and appends `px` automatically, so you can bind a raw number without formatting it yourself. Mixing them up — passing a bare number to the non-suffixed form — results in an invalid CSS value that the browser silently ignores.

**Q: How does `[style]="{...}"` differ from `[attr.style]="'...'"`?**
A: `[style]` (and `[ngStyle]`) takes an object map of individual CSS properties and merges them with the element's other inline styles, updating only the properties present in the map on each change-detection diff. `[attr.style]` sets the raw `style` attribute string as one blob, replacing the entire inline style on every change — it doesn't merge with anything else, so any other statically-declared or separately-bound styles get wiped out.

**Q: Are unit suffixes required for every CSS property bound via `[style.x.unit]`?**
A: No — a handful of CSS properties are unitless by specification, including `opacity`, `z-index`, `line-height` (when given as a plain number), and `flex-grow`/`flex-shrink`. Adding a unit suffix to those produces an invalid value that the browser drops. You only use a unit suffix for properties whose CSS values genuinely require a length/percentage unit, like `width`, `height`, `margin`, `padding`, or `font-size`.

**Q: When would you choose `[style.x]`/`[ngStyle]` over conditionally applying a CSS class with `[class.x]`?**
A: Style bindings are the right tool for values that are genuinely computed at runtime and can't be expressed as a fixed, enumerable set of states — a drag position, a progress-bar percentage, a color interpolated from user data. Class bindings are better whenever the visual states are a known, finite set (error/warning/success, selected/unselected) because then the actual style rules live in a stylesheet where they're themeable, cacheable, and easier to override — hardcoding computed inline styles for what's really a fixed set of states makes the styling harder to maintain and bypasses normal CSS specificity/cascade tooling.

## Related Topics

- [class-binding.md](./class-binding.md)
- [attribute-binding.md](./attribute-binding.md)
- [property-binding.md](./property-binding.md)
- [data-binding.md](./data-binding.md)
