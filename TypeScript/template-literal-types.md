# Template Literal Types

Template literal types let you build new string literal types by combining fixed text with other types, using the same `` `${...}` `` syntax as a JavaScript template literal, but at the type level. Given a union of literal types, a template literal type distributes over that union to produce a new union — e.g., `` `on${Capitalize<"click" | "hover">}` `` produces `"onClick" | "onHover"`, generating every combination automatically rather than requiring you to hand-write each variant.

This is especially powerful when combined with mapped types and `keyof` to build derived string-based APIs from an existing type's keys — the canonical example is generating event-handler-prop names (`onClick`, `onHover`) from a set of event names (`click`, `hover`), or generating CSS-like property key unions (`"margin-top" | "margin-left" | ...`) from a base list. TypeScript ships four intrinsic string-manipulation types specifically to pair with template literal types: `Uppercase<S>`, `Lowercase<S>`, `Capitalize<S>`, and `Uncapitalize<S>`, each operating purely at the type level on string literal types.

Template literal types can also validate the *shape* of a string, not just its exact value — e.g., a type like `` `#${string}` `` matches any string starting with `#`, useful for lightly validating patterns like hex colors, route paths (`` `/users/${string}` ``), or versioned keys, without needing a full regex-based validator (TypeScript's type system can't express arbitrary regex, only literal/wildcard string structure).

Where this shows up in real projects: strongly-typed routing libraries, CSS-in-JS libraries typing property names, form libraries deriving field-path types (`"address.street"`) from a nested object type, and any API that needs to programmatically derive one set of string literal types from another instead of maintaining two lists in sync by hand.

## Examples

```ts
// Basic template literal type combining a union with fixed text
type EventName = "click" | "hover" | "focus";
type HandlerName = `on${Capitalize<EventName>}`;
// "onClick" | "onHover" | "onFocus"

function addHandler(name: HandlerName, fn: () => void) { /* ... */ }
addHandler("onClick", () => {});
// addHandler("onclick", () => {}); // Compile error — case matters, not in the union
```

```ts
// Combining with a mapped type to auto-generate event handler props from event names
type Events = "click" | "change";
type Handlers = {
  [K in Events as `on${Capitalize<K>}`]: (event: Event) => void;
};
// Equivalent to: { onClick: (event: Event) => void; onChange: (event: Event) => void }
```

```ts
// Pattern-matching a string's shape (not just its exact literal value)
type HexColor = `#${string}`;
function setColor(color: HexColor) { /* ... */ }
setColor("#ff0000"); // OK — matches the `#${string}` pattern
// setColor("ff0000"); // Compile error — missing the required leading '#'

type Route = `/users/${string}` | `/posts/${string}`;
const path: Route = "/users/42"; // OK
```

## Common Pitfalls / Gotchas

- Expecting template literal types to validate arbitrary content, like a full regex pattern (e.g., "exactly 6 hex digits") — they can only express literal text plus wildcard placeholders (`string`, `number`, or another union/literal type), not general regular expressions.
- Forgetting that a template literal type built from a union *distributes* over every combination — combining two unions of sizes `m` and `n` produces up to `m × n` resulting literal types, which can balloon quickly and slow down type-checking on very large unions.
- Not using `Capitalize`/`Uncapitalize`/`Uppercase`/`Lowercase` where needed and ending up with a mismatched-case union (e.g., generating `onclick` instead of the intended `onClick`).
- Assuming a value that merely *contains* the right substring will satisfy a `` `${string}` ``-style pattern type in the wrong position — the pattern is anchored to the literal text's exact position (prefix/suffix/middle), not a general "contains" check.

## Interview Questions & Answers

**Q: What is a template literal type, and what's a practical use case for one?**
A: It's a type-level equivalent of a JS template literal — combining fixed text with other types (often literal unions) using `` `${...}` `` syntax to generate new string literal types. A common use case is deriving event handler prop names (`onClick`, `onHover`) from a union of event names (`click`, `hover`) without hand-writing every combination.

**Q: What happens when you build a template literal type from a union with multiple members?**
A: TypeScript distributes across the union, producing the cross-product of every combination as a new union of string literal types — e.g., `` `${"a"|"b"}-${"x"|"y"}` `` produces `"a-x" | "a-y" | "b-x" | "b-y"`.

**Q: What are the four intrinsic string-manipulation types TypeScript provides for use with template literal types?**
A: `Uppercase<S>`, `Lowercase<S>`, `Capitalize<S>`, and `Uncapitalize<S>` — they transform string literal types at the type level and are most often used inside template literal types or mapped type key remapping.

**Q: Can template literal types validate a full regular expression pattern, like a valid email format?**
A: No — they can only express literal text combined with wildcard placeholders like `string`/`number`/a literal union at specific positions (prefix, suffix, or in the middle). They can check structural patterns like "starts with `#`" or "is `/users/` followed by anything," but not arbitrary regex constraints.

## Related Topics
- [literal-types.md](./literal-types.md)
- [mapped-types.md](./mapped-types.md)
- [keyof-operator.md](./keyof-operator.md)
- [union-types.md](./union-types.md)
- [conditional-types.md](./conditional-types.md)
