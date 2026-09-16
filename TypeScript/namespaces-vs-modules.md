# Namespaces vs Modules

Namespaces and ES Modules solve an overlapping problem — organizing code and avoiding naming collisions — but they come from different eras of TypeScript's history and differ in nearly every practical dimension: how they're declared, how dependencies between them are expressed, what they compile to, and how well modern tooling understands them. This comparison is a common interview question specifically because many developers have only ever worked with modules and have never seen `namespace` syntax in real code, so being able to explain *why* the ecosystem moved away from namespaces (rather than just stating that it did) demonstrates real understanding of the trade-offs involved.

**Declaration and access**: a namespace is declared with the `namespace` keyword and accessed via dot notation on a shared name (`MyNamespace.someFunction()`); a module is just a regular file containing `import`/`export` statements, with each file being its own implicitly-scoped unit, and consumers pull in exactly the named bindings they need via `import { someFunction } from "./file"`. **Dependency declaration**: namespaces spanning multiple files rely on triple-slash reference directives to link them together, a mechanism understood only by the TypeScript compiler itself; modules use standard `import` statements, understood natively by every JavaScript runtime, bundler, and static analysis tool in the modern ecosystem. **Compiled output**: a namespace compiles to a real runtime object (often IIFE-wrapped); an ES Module compiles to standard `import`/`export` statements (or, under an older module target, to CommonJS `require`/`module.exports`) that match exactly what the rest of the JavaScript ecosystem expects and can optimize.

**Tooling and ecosystem fit** is where the practical gap is widest: modules are statically analyzable, enabling accurate tree-shaking (dead-code elimination) by bundlers, and integrate seamlessly with npm packages, code-splitting, and every mainstream build tool. Namespaces predate this tooling ecosystem entirely and were never designed with it in mind — bundlers generally have no special understanding of triple-slash references or namespace-spanning file dependencies, making namespace-organized code awkward or impossible to properly tree-shake or code-split.

The practical guidance every mainstream style guide converges on: use ES Modules for all application and library code organization going forward; reserve `namespace` exclusively for the one case modules can't cleanly replace — typing legacy global (non-module) JavaScript libraries inside `.d.ts` declaration files, where a `declare global` or `declare namespace` block accurately models a library that genuinely does expose itself as a global object rather than an importable module.

## Examples

```ts
// Namespace style — dot-notation access, shared global-ish container
namespace MathUtils {
  export function square(n: number): number { return n * n; }
}
console.log(MathUtils.square(5));
```

```ts
// Equivalent, modern module style — file-scoped, explicit imports
// mathUtils.ts
export function square(n: number): number { return n * n; }

// main.ts
import { square } from "./mathUtils";
console.log(square(5));
```

```ts
// The one clearly legitimate remaining namespace use case: typing a legacy global library
// global-lib.d.ts
declare global {
  namespace MyGlobalLib {
    function init(config: object): void;
  }
}
// Describes a library loaded via <script> that exposes `window.MyGlobalLib`,
// with no actual ES Module involved at runtime — modules can't model this scenario.
```

## Common Pitfalls / Gotchas

- Choosing namespaces for new application code organization "because they're simpler" — the short-term simplicity is outweighed by losing tree-shaking, code-splitting, and broad ecosystem/tooling compatibility, all of which modules provide essentially for free.
- Assuming a bundler will understand and optimize namespace-organized code the way it does ES Modules — most modern bundlers have no special handling for `namespace`/triple-slash-reference-based code organization at all.
- Forgetting that a namespace produces real runtime JavaScript (an object, typically IIFE-wrapped), while properly tree-shaken, unused ES Module exports can often be eliminated entirely from a bundle — a genuine bundle-size implication, not just a stylistic one.
- Trying to model a genuinely global (non-module) legacy library's shape using `export`/`import` instead of `declare global`/`declare namespace` in a `.d.ts` file — modules assume the code they describe is imported somewhere; a truly global library (loaded via `<script>`, with no module system involved) needs the global/namespace declaration style instead.

## Interview Questions & Answers

**Q: What's the main practical reason ES Modules are preferred over namespaces for organizing modern TypeScript code?**
A: Modules are statically analyzable by the entire modern JavaScript tooling ecosystem — bundlers can accurately tree-shake unused exports, support code-splitting, and understand `import`/`export` natively. Namespaces predate this tooling ecosystem, rely on TypeScript-only mechanisms like triple-slash references for cross-file dependencies, and generally aren't understood or optimized by mainstream bundlers at all.

**Q: Do namespaces and modules compile to fundamentally different JavaScript output?**
A: Yes — a namespace compiles to a real runtime object, commonly wrapped in an IIFE, that member functions/values get attached to. An ES Module compiles to standard `import`/`export` syntax (or CommonJS `require`/`module.exports` for older targets), matching what the rest of the JavaScript ecosystem natively expects and can process.

**Q: Is there any legitimate remaining use case for `namespace` in modern TypeScript?**
A: Yes — typing legacy global JavaScript libraries inside `.d.ts` declaration files. A library that predates ES Modules and exposes itself as a single global variable (loaded via a `<script>` tag rather than imported) is idiomatically described using `declare global`/`declare namespace`, since there's no actual module for `import`/`export` syntax to describe in that scenario.

**Q: How do namespaces handle dependencies across multiple files, and why is this considered a weaker mechanism than ES Module imports?**
A: Via triple-slash reference directives (`/// <reference path="..." />`), which the TypeScript compiler follows to know which files' namespace declarations to merge together. This mechanism is understood only by `tsc` itself — most bundlers and other JavaScript tooling have no concept of it, unlike standard `import` statements, which are a universally understood part of the JavaScript module ecosystem.

## Related Topics
- [namespaces.md](./namespaces.md)
- [modules-in-typescript.md](./modules-in-typescript.md)
- [declaration-files.md](./declaration-files.md)
- [module-augmentation.md](./module-augmentation.md)
- [compiling-typescript.md](./compiling-typescript.md)
