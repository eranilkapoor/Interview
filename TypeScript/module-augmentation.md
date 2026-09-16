# Module Augmentation / Declaration Merging

Module augmentation is the technique of adding new members to an *existing* module's or global type's declaration from a separate file — most commonly used to extend a third-party library's types with custom additions, without modifying that library's own source code at all. It relies directly on **declaration merging**, the same mechanism covered in [interfaces.md](./interfaces.md): if TypeScript sees multiple declarations for the same interface (or the same module), it combines all of their members into one merged type, rather than treating the later declaration as an error or an override.

The canonical real-world example is extending Express's `Request` interface to add a custom property set by authentication middleware — Express's own types don't (and shouldn't) know about your app's specific `req.user` property, so you declare `declare global { namespace Express { interface Request { user?: MyUser; } } }` in your own project, and TypeScript merges it with Express's own `Request` interface declaration everywhere in your codebase, making `req.user` fully typed and autocompletable without ever touching Express's actual source or type definitions.

A closely related but distinct pattern augments a *module* rather than the global scope: `declare module "some-library" { export interface Options { customFlag?: boolean; } }` reopens that specific module's exported `Options` interface and merges your additional property into it — this requires the file doing the augmenting to itself be a module (containing at least one real `import`/`export`), and the `declare module "exact-module-name"` string must match the target module's actual import specifier precisely. This is the standard way third-party plugin systems let consumers add typed configuration options to a base library's types (a common pattern in libraries with a plugin architecture, like certain Vite or Webpack config type extensions).

Declaration merging (and by extension module augmentation) works specifically because **interfaces** support it — it does not work for `type` aliases, which cannot be redeclared at all; if the type you need to extend was defined as a `type` alias rather than an `interface` in the library's own source, augmenting it this way isn't possible, and you'd need a different approach (like a wrapper/intersection type on your own end instead).

## Examples

```ts
// Augmenting a well-known global type (Window) via declare global
// window-augment.d.ts
export {}; // makes this file a module, required for declare global to apply correctly
declare global {
  interface Window {
    analyticsQueue: Array<{ event: string; timestamp: number }>;
  }
}
window.analyticsQueue = []; // fully typed, thanks to the merge with the built-in Window interface
```

```ts
// The canonical Express Request augmentation pattern
// express-augment.d.ts
import "express"; // ensures this file is treated as augmenting the real "express" module
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: string };
    }
  }
}

// Now usable, fully typed, in any route handler across the project:
// app.get("/profile", (req, res) => { console.log(req.user?.role); });
```

```ts
// Augmenting a specific module's exported interface (not the global scope)
// my-augment.d.ts
declare module "some-config-library" {
  export interface Options {
    customFlag?: boolean; // merges into the library's own exported Options interface
  }
}
```

## Common Pitfalls / Gotchas

- Trying to augment a type that was originally declared with `type` instead of `interface` — declaration merging only works for interfaces; a `type` alias cannot be reopened or merged with a second declaration under the same name.
- Forgetting to make the augmenting file itself a module (via `export {}` or a real import) when using `declare global` — without this, the file is treated as a plain global script, and the `declare global` block doesn't apply in the intended, scoped-augmentation way.
- Getting the `declare module "..."` string slightly wrong (a typo, or an incorrect casing/path) — the string must exactly match the target module's actual import specifier, or the augmentation silently fails to merge with anything, with no compile error to indicate the mismatch.
- Not including the augmenting `.d.ts` file in the project's `tsconfig.json` `include`/`files` compilation scope — if the file isn't actually part of the compiled program, its augmentation never takes effect, even though the file itself may contain no syntax errors.

## Interview Questions & Answers

**Q: What is module augmentation, and what TypeScript mechanism does it rely on?**
A: It's the technique of adding new members to an existing module's or global type's declaration from a separate file, without modifying that type's original source. It relies on declaration merging — TypeScript automatically combines multiple interface declarations sharing the same name (in the same or an appropriately linked scope) into one merged type.

**Q: How would you add a custom `user` property to Express's `Request` type without modifying Express's own source code?**
A: Write a `.d.ts` file with `declare global { namespace Express { interface Request { user?: MyUser; } } }`. TypeScript merges this with Express's own `Request` interface declaration, making `req.user` typed and autocompletable everywhere in the project, since it's now part of the same merged interface.

**Q: Can you augment a type that was defined using `type` instead of `interface`?**
A: No — declaration merging is an interface-only feature. Type aliases cannot be redeclared under the same name at all (it's a compile error), so there's no way to "reopen" and add to a `type` alias the way you can with an `interface`.

**Q: What's the difference between augmenting the global scope with `declare global` versus augmenting a specific module with `declare module "module-name"`?**
A: `declare global` adds/merges members into the true global scope (like the built-in `Window` type), and requires the augmenting file itself to be a module. `declare module "module-name"` instead reopens and merges into a *specific* module's own exported types, with the string needing to exactly match that module's real import specifier — commonly used to extend a library's exported configuration/options types.

## Related Topics
- [interfaces.md](./interfaces.md)
- [declaration-files.md](./declaration-files.md)
- [namespaces.md](./namespaces.md)
- [modules-in-typescript.md](./modules-in-typescript.md)
- [typescript-with-javascript-interop.md](./typescript-with-javascript-interop.md)
