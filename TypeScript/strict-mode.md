# Strict Mode and Its Sub-Flags

`"strict": true` in `tsconfig.json` is a single umbrella flag that enables a whole bundle of individually-toggleable, stricter type-checking behaviors at once — it's the single highest-leverage setting for getting real value out of TypeScript, and virtually every modern style guide and the TypeScript team itself recommend enabling it, especially for any new project starting from scratch. Each sub-flag can also be set individually (and even overridden to `false` while `strict` is otherwise `true`), which matters most during incremental adoption on an existing, previously-loose codebase, where flipping every sub-flag on simultaneously can surface an overwhelming number of pre-existing latent issues all at once.

The most impactful sub-flags: **`strictNullChecks`** is widely considered the single most valuable one — without it, `null` and `undefined` are silently assignable to every type, defeating a huge portion of what makes TypeScript catch real bugs; with it, they must be explicitly included in a type's union, and the compiler forces you to handle the nullish case before use. **`noImplicitAny`** requires every value's type to be explicitly known or inferable — without it, TypeScript silently falls back to `any` for parameters/values it can't infer, quietly disabling checking exactly where it's often needed most. **`strictFunctionTypes`** tightens function-type-variable parameter checking to be properly contravariant rather than the more permissive default bivariant checking (see [type-compatibility-and-variance.md](./type-compatibility-and-variance.md)). **`strictPropertyInitialization`** (which itself depends on `strictNullChecks` being on) requires every class field to be definitely assigned by the end of the constructor. **`strictBindCallApply`** properly type-checks the arguments passed to `.bind()`/`.call()`/`.apply()` against the target function's actual signature, rather than accepting anything. **`noImplicitThis`** flags a `this` reference whose type can't be determined, rather than silently typing it as `any`. **`alwaysStrict`** ensures every emitted file includes JavaScript's own `"use strict"` runtime directive.

Beyond the flags bundled directly into `strict`, several **closely related but separate** flags are commonly paired with it for even tighter safety: **`noUncheckedIndexedAccess`** (covered in [index-signatures.md](./index-signatures.md)) makes indexed access on dictionary-like types include `| undefined`, correctly modeling missing keys; **`noImplicitOverride`** requires the `override` keyword whenever a subclass method genuinely overrides a parent method; **`exactOptionalPropertyTypes`** distinguishes a property that's genuinely absent from one explicitly set to `undefined`, closing a subtle gap that even `strictNullChecks` alone leaves open for optional (`?`) properties specifically.

Adopting `strict` mode on a large, previously non-strict existing codebase is a real, often substantial migration — it's common to enable it file-by-file (via per-file `// @ts-strict-ignore`-style suppressions, or a incremental `tsconfig.json` split between already-migrated and not-yet-migrated file sets) rather than flipping the flag globally and being confronted with hundreds of pre-existing errors simultaneously.

## Examples

```ts
// strictNullChecks catching a real bug that would otherwise pass silently
function getUserName(user: { name: string } | null): string {
  // return user.name; // Compile error with strictNullChecks: user might be null
  return user?.name ?? "Unknown"; // forced to handle the null case explicitly
}
```

```ts
// noImplicitAny catching a parameter TypeScript can't infer
// function double(x) { return x * 2; } // Compile error: parameter 'x' implicitly has an 'any' type
function double(x: number): number { return x * 2; } // fixed with an explicit annotation
```

```ts
// strictPropertyInitialization catching a class field that might never be assigned
class Service {
  // config: Config; // Compile error: Property 'config' has no initializer
  config: Config = defaultConfig; // fixed — or assign in the constructor instead
}
interface Config { apiUrl: string; }
declare const defaultConfig: Config;
```

## Common Pitfalls / Gotchas

- Enabling `strict: true` on a large existing codebase all at once and being overwhelmed by hundreds of newly-surfaced errors — these are almost always pre-existing latent bugs the looser settings were previously hiding, not new problems introduced by turning the flag on; migrate incrementally where the codebase is large.
- Assuming `strict: true` covers *every* useful strictness-related check TypeScript offers — several valuable flags (`noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`) are deliberately kept separate from the `strict` bundle and must be enabled individually.
- Turning off `strictNullChecks` specifically (while leaving other strict sub-flags on) to silence errors quickly — this is usually the single highest-value check to keep enabled, since so many real-world bugs stem from unexpected `null`/`undefined`, more than any other single category strict mode addresses.
- Forgetting `strictPropertyInitialization` depends on `strictNullChecks` being enabled to have any meaningful effect — the two are related and typically should be considered together, not independently.

## Interview Questions & Answers

**Q: What does `"strict": true` actually do in `tsconfig.json`?**
A: It's a single umbrella flag that enables a whole bundle of individually-toggleable, stricter type-checking sub-flags at once — including `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`, `strictBindCallApply`, `noImplicitThis`, and `alwaysStrict`. Each can also be configured individually, which matters most for incremental adoption on an existing codebase.

**Q: Why is `strictNullChecks` often called out as the single most valuable strict sub-flag?**
A: Without it, `null` and `undefined` are silently assignable to every type, meaning the compiler can't catch a huge, very common category of real bugs (accessing a property on something that turned out to be null/undefined). With it enabled, `null`/`undefined` must be explicitly part of a type's union, and the compiler forces you to handle that possibility before use — directly preventing one of the most frequent real-world JavaScript runtime errors.

**Q: What does `noImplicitAny` prevent, and why does it matter?**
A: It flags any value/parameter whose type TypeScript can't infer and would otherwise silently default to `any` — without this flag, such values quietly lose all type checking. Enabling it forces every value to have an explicit or inferable type, closing an easy, easy-to-miss escape hatch back into untyped JavaScript-like behavior.

**Q: Are `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` part of the `strict` bundle?**
A: No — despite being closely related in spirit and commonly recommended alongside `strict: true`, both are separate, opt-in flags that must be enabled individually. `noUncheckedIndexedAccess` adds `| undefined` to indexed dictionary access; `exactOptionalPropertyTypes` distinguishes a property that's genuinely absent from one explicitly set to `undefined`.

## Related Topics
- [tsconfig.md](./tsconfig.md)
- [basic-types.md](./basic-types.md)
- [type-compatibility-and-variance.md](./type-compatibility-and-variance.md)
- [index-signatures.md](./index-signatures.md)
- [non-null-assertion-operator.md](./non-null-assertion-operator.md)
