# Namespaces

A namespace, declared with the `namespace` keyword, is a TypeScript-specific way to group related code — variables, functions, interfaces, classes — under a single named container, primarily to avoid naming collisions in the global scope. `namespace Validation { export function isValidEmail(s: string): boolean { ... } }` groups related validators together, and consumers reference members via dot notation (`Validation.isValidEmail(...)`), similar in spirit to a package or a static class. Namespaces predate ES Modules in TypeScript's history (they were originally even called "internal modules," before ES Modules existed as a real JavaScript standard) and were TypeScript's original answer to code organization before native modules became the widely-adopted standard.

Under the hood, a namespace compiles to a plain JavaScript object, typically wrapped in an immediately-invoked function expression (IIFE) that attaches its exported members onto a shared object — this is genuinely different from an ES Module, which the module system treats as a first-class, statically-analyzable unit with its own dedicated file scope and no runtime object of its own. Namespaces can span *multiple files* using triple-slash reference directives (`/// <reference path="..." />`) to declare that one file depends on another, with all the referenced files' namespace declarations merging together — this was TypeScript's answer to splitting large namespace-organized codebases across files before ES Modules offered a cleaner, standardized way to do the same thing.

In modern TypeScript development, namespaces are largely considered a **legacy pattern** for organizing application code — ES Modules (`import`/`export`) are now the standard, broadly recommended approach, offering better tooling support, static analyzability (enabling tree-shaking), and universal compatibility with the wider JavaScript ecosystem and bundlers. The TypeScript team's own documentation explicitly steers new code toward ES Modules over namespaces for this reason.

Namespaces do still have one clearly legitimate, ongoing use case: **declaring the shape of legacy global libraries** in `.d.ts` declaration files — many older libraries that predate ES Modules expose themselves as a single global variable with nested members, and a `declare namespace` block is the idiomatic way to type that global shape accurately (see [declaration-files.md](./declaration-files.md)).

## Examples

```ts
// A basic namespace — groups related members, avoids polluting the global scope directly
namespace Validation {
  export function isValidEmail(s: string): boolean {
    return /\S+@\S+\.\S+/.test(s);
  }
  export function isValidPhone(s: string): boolean {
    return /^\d{10}$/.test(s);
  }
}
console.log(Validation.isValidEmail("anil@example.com")); // accessed via dot notation
```

```ts
// Nested namespaces
namespace App {
  export namespace Utils {
    export function formatDate(d: Date): string {
      return d.toISOString();
    }
  }
}
console.log(App.Utils.formatDate(new Date()));
```

```ts
// The still-legitimate modern use case: typing a legacy global library in a .d.ts file
declare namespace jQuery {
  function ajax(url: string, options?: object): void;
  interface JQueryStatic {
    (selector: string): JQueryStatic;
  }
}
// Lets TypeScript understand a global `jQuery`/`$` object provided by a <script> tag,
// with no actual module/import involved at runtime.
```

## Common Pitfalls / Gotchas

- Using namespaces for new application code organization instead of ES Modules — namespaces lack the tooling support, static analyzability, and bundler/tree-shaking compatibility of modules, and TypeScript's own documentation recommends modules for new code.
- Forgetting that `namespace` blocks compile to a real runtime object/IIFE — unlike an interface or type alias, this is not a fully-erased, zero-cost construct; it has genuine runtime footprint.
- Mixing namespaces and ES Modules carelessly in the same project — combining `namespace` and `export`/`import` syntax in confusing ways (e.g., trying to `export namespace` from within a module file for reasons other than declaration files) tends to produce unintuitive, hard-to-predict compiled output.
- Assuming triple-slash references (`/// <reference path="..." />`) work the same way module `import`s do for dependency tracking by build tools — many modern bundlers don't understand triple-slash directives at all, since they predate the module ecosystem those tools are built around.

## Interview Questions & Answers

**Q: What is a TypeScript namespace, and what problem was it originally designed to solve?**
A: A `namespace` groups related code (functions, interfaces, classes) under one named container to avoid global scope naming collisions, accessed via dot notation. It predates ES Modules in TypeScript's history and was the language's original mechanism for code organization before native JavaScript modules existed as a widely-supported standard.

**Q: Are namespaces recommended for organizing new TypeScript application code today?**
A: No — ES Modules (`import`/`export`) are the modern, broadly recommended standard, offering better tooling, static analyzability (enabling tree-shaking), and universal ecosystem/bundler compatibility. TypeScript's own documentation explicitly steers new code toward modules rather than namespaces.

**Q: Does a `namespace` produce any runtime JavaScript, unlike an interface or type alias?**
A: Yes — a namespace compiles to a real runtime object, typically wrapped in an IIFE that attaches its exported members onto that shared object. This is a meaningful difference from purely compile-time-erased constructs like interfaces and type aliases, which leave no runtime trace at all.

**Q: What's a legitimate, still-current use case for namespaces in modern TypeScript?**
A: Declaring the shape of legacy global JavaScript libraries in `.d.ts` declaration files — many older libraries expose themselves as a single global variable with nested members (rather than as an ES Module), and a `declare namespace` block is the idiomatic way to accurately type that global shape for consumers.

## Related Topics
- [namespaces-vs-modules.md](./namespaces-vs-modules.md)
- [modules-in-typescript.md](./modules-in-typescript.md)
- [declaration-files.md](./declaration-files.md)
- [module-augmentation.md](./module-augmentation.md)
- [tsconfig.md](./tsconfig.md)
