# Introduction to TypeScript

TypeScript is a statically-typed superset of JavaScript developed and maintained by Microsoft. Every valid JavaScript program is (almost) valid TypeScript — TypeScript doesn't replace JavaScript, it layers an optional static type system, modern syntax support, and tooling on top of it, then **compiles down to plain JavaScript** that runs anywhere JavaScript runs (browsers, Node.js, Deno, embedded runtimes). The compiler (`tsc`) erases all type information at build time — types exist purely to help you while writing and reviewing code; they have zero runtime footprint or performance cost.

The core motivation for TypeScript is catching an entire class of bugs — wrong argument types, typos in property names, `undefined` where an object was expected, mismatched function signatures — **before** the code ever runs, instead of discovering them in production or during a `TypeError` at 2am. JavaScript is dynamically typed: a variable can hold any type, and the engine only discovers a type mismatch when the offending line actually executes. TypeScript's static analysis walks your entire codebase at compile time (and continuously in your editor via the Language Service) and flags mismatches immediately, often before you've even saved the file.

Beyond bug-catching, TypeScript's biggest practical win is **tooling**: because the compiler knows the shape of every value, editors can offer accurate autocomplete, inline documentation, "go to definition," "find all references," and safe automated refactors (like renaming a property across an entire codebase) — all things that are unreliable or impossible with plain JavaScript because the editor has to guess. This matters enormously as codebases and teams grow: a function signature or object shape becomes self-documenting and enforced, rather than relying on comments, tribal knowledge, or runtime crashes to communicate a contract.

TypeScript also lets teams adopt typing incrementally. You can start with `allowJs`/`checkJs` and JSDoc annotations on existing `.js` files, rename files to `.ts` one at a time, and dial up strictness (`strict: true` and its sub-flags) as confidence grows. This gradual-adoption story, combined with the fact that TypeScript is "just JavaScript plus types" rather than a wholly different language, is why it has become the de facto standard for medium-to-large JavaScript codebases, and virtually a requirement for serious frontend (React, Angular, Vue) and Node.js backend work today.

## Examples

```ts
// Plain JavaScript has no way to catch this until it runs:
function greet(name) {
  return "Hello, " + name.toUpperCase();
}
greet(42); // runtime TypeError: name.toUpperCase is not a function

// TypeScript catches it immediately, at compile time, in the editor:
function greetTS(name: string): string {
  return "Hello, " + name.toUpperCase();
}
greetTS(42); // Compile error: Argument of type 'number' is not assignable to parameter of type 'string'.
```

```ts
// Types describe shapes/contracts, which then get enforced everywhere that shape is used
interface User {
  id: number;
  name: string;
  email?: string; // optional
}

function sendWelcomeEmail(user: User): void {
  console.log(`Sending email to ${user.name}`);
}

sendWelcomeEmail({ id: 1, name: "Anil" }); // OK, email is optional
sendWelcomeEmail({ id: 1 }); // Compile error: Property 'name' is missing
```

```ts
// TypeScript compiles to plain JS — the types are gone in the output.
// Input (input.ts):
const add = (a: number, b: number): number => a + b;

// Output after `tsc` (input.js):
// const add = (a, b) => a + b;
```

## Common Pitfalls / Gotchas

- Thinking TypeScript adds runtime safety — it doesn't. Types are fully erased at compile time; if untyped/`any` data enters your app at runtime (e.g., a JSON API response), TypeScript cannot stop a shape mismatch from crashing your code. Runtime validation (e.g., Zod, `io-ts`) is still needed at trust boundaries.
- Reaching for `any` to silence errors quickly — this opts entire values out of type checking and defeats the purpose of using TypeScript in the first place; prefer `unknown` plus narrowing instead.
- Assuming TypeScript enforces types across `.js` files by default — you need `checkJs`/`allowJs` (or a `.ts`/`.tsx` extension) for type checking to apply at all.
- Believing stricter settings can always be added later "for free" — turning on `strict` mode on a large existing codebase can surface hundreds of pre-existing latent bugs at once; it's much cheaper to start strict from day one.

## Interview Questions & Answers

**Q: What is TypeScript, and how does it relate to JavaScript?**
A: TypeScript is a statically-typed superset of JavaScript — every JavaScript feature is available in TypeScript, plus an optional static type system, newer syntax, and better tooling. The TypeScript compiler (`tsc`) type-checks the code and then strips all type annotations, emitting plain JavaScript that runs in any JS environment.

**Q: Does TypeScript improve runtime performance or catch runtime errors?**
A: No. Types are fully erased at compile time and add zero runtime overhead, but they also provide zero runtime protection — if unvalidated external data doesn't match its declared type, TypeScript can't stop the resulting bug at runtime. It only helps at compile time / in the editor.

**Q: Why would a team choose TypeScript over plain JavaScript for a large codebase?**
A: Static types catch a large class of bugs (wrong types, typos, missing properties, mismatched function signatures) before the code runs, self-document contracts between modules/teams, and unlock reliable tooling — accurate autocomplete, safe renames, "find all references" — all of which scale much better than plain JavaScript as a codebase and team grow.

**Q: Can you adopt TypeScript incrementally in an existing JavaScript project?**
A: Yes — via `allowJs`/`checkJs` to type-check existing `.js` files using JSDoc annotations, renaming files to `.ts`/`.tsx` one at a time, setting `strict: false` initially and tightening it later, and using `// @ts-nocheck` or `any` as temporary escape hatches during migration.

**Q: What actually happens when you run `tsc` on a `.ts` file?**
A: The compiler parses the file, builds an AST, resolves and checks all types against your `tsconfig.json` rules, reports any type errors, and then emits `.js` (and optionally `.d.ts` declaration files and source maps) with all type annotations stripped out — the emitted JavaScript is what actually runs.

## Related Topics
- [basic-types.md](./basic-types.md)
- [tsconfig.md](./tsconfig.md)
- [strict-mode.md](./strict-mode.md)
- [compiling-typescript.md](./compiling-typescript.md)
- [typescript-with-javascript-interop.md](./typescript-with-javascript-interop.md)
