# TypeScript Interview Prep

This folder is a personal knowledge base for studying and teaching TypeScript concepts, built for interview preparation and for explaining these topics to others. Each file covers one topic in depth — a conceptual explanation, runnable code examples, common pitfalls, and interview-style Q&A — so you can both refresh your own understanding quickly and use the material to walk someone else through the same concept from scratch. It's designed as the natural next step after the sibling [JavaScript folder](../JavaScript/README.md): TypeScript is a superset of JavaScript, so every JS fundamental still applies — this folder focuses specifically on what TypeScript adds on top.

## Table of Contents

### Fundamentals & Types
- [Introduction to TypeScript](./introduction-to-typescript.md)
- [Basic Types](./basic-types.md)
- [any, unknown, never, void](./any-unknown-never-void.md)
- [Arrays and Tuples](./arrays-and-tuples.md)
- [Enums](./enums.md)
- [Literal Types](./literal-types.md)
- [Type Inference](./type-inference.md)
- [Type Assertions / Type Casting](./type-assertions.md)
- [Structural Typing / Duck Typing](./structural-typing.md)
- [Const Assertions (`as const`)](./const-assertions.md)
- [Template Literal Types](./template-literal-types.md)

### Interfaces & Type Aliases
- [Interfaces](./interfaces.md)
- [Type Aliases](./type-aliases.md)
- [Interfaces vs Type Aliases](./interfaces-vs-type-aliases.md)
- [Union Types](./union-types.md)
- [Intersection Types](./intersection-types.md)
- [Discriminated Unions](./discriminated-unions.md)
- [Index Signatures](./index-signatures.md)

### Functions & Generics
- [Functions in TypeScript](./functions-in-typescript.md)
- [Generics](./generics.md)
- [Generic Constraints](./generic-constraints.md)
- [Generics with React](./generics-with-react.md)

### Classes & OOP
- [Classes in TypeScript](./classes-in-typescript.md)
- [Access Modifiers (public, private, protected)](./access-modifiers.md)
- [Readonly Properties](./readonly-properties.md)
- [Abstract Classes](./abstract-classes.md)
- [Interfaces vs Abstract Classes](./interfaces-vs-abstract-classes.md)
- [Decorators](./decorators.md)

### Advanced Types
- [keyof Operator](./keyof-operator.md)
- [typeof Operator (Type Context)](./typeof-operator.md)
- [Mapped Types](./mapped-types.md)
- [Conditional Types](./conditional-types.md)
- [Utility Types](./utility-types.md)
- [Type Guards & Narrowing](./type-guards-and-narrowing.md)
- [Optional Chaining & Nullish Coalescing](./optional-chaining-and-nullish-coalescing.md)
- [Non-Null Assertion Operator](./non-null-assertion-operator.md)
- [Type Compatibility / Variance](./type-compatibility-and-variance.md)

### Modules & Project Config
- [Modules in TypeScript](./modules-in-typescript.md)
- [Namespaces](./namespaces.md)
- [Namespaces vs Modules](./namespaces-vs-modules.md)
- [Declaration Files (.d.ts) and Ambient Declarations](./declaration-files.md)
- [Module Augmentation / Declaration Merging](./module-augmentation.md)
- [tsconfig.json (Key Compiler Options)](./tsconfig.md)
- [Strict Mode and Its Sub-Flags](./strict-mode.md)

### Interop & Tooling
- [Compiling TypeScript (tsc, ts-node, transpileOnly)](./compiling-typescript.md)
- [TypeScript with JavaScript Interop](./typescript-with-javascript-interop.md)

## Interview Questions & Answers — Curated

**1. What's the difference between `any` and `unknown`? (Beginner/Intermediate)**
Both can hold any value, but `any` disables type checking entirely — every operation on it is permitted with no compile error. `unknown` is the type-safe alternative: it can hold any value too, but you must narrow it (via `typeof`, `instanceof`, a type guard) to a more specific type before you're allowed to use it in any way. Prefer `unknown` at the boundaries of your app (API responses, `catch` blocks) wherever `any` would otherwise be reached for. See [any-unknown-never-void.md](./any-unknown-never-void.md).

**2. How does structural typing differ from nominal typing, and which does TypeScript use? (Intermediate)**
TypeScript is structurally typed: two types are compatible if they have the same shape (matching members with compatible types), regardless of how — or whether — they're formally declared to be related. Nominal typing (Java, C#) instead requires an explicit `implements`/`extends` declaration for compatibility, even if the shapes match exactly. This is why a plain object literal or an unrelated class instance can satisfy a TypeScript interface with no `implements` clause at all. See [structural-typing.md](./structural-typing.md).

**3. Explain how `Partial<T>` and `Pick<T, K>` are implemented under the hood using mapped types. (Advanced)**
`Partial<T>` is `{ [K in keyof T]?: T[K] }` — it iterates over every key of `T` via a mapped type and adds the `?` optional modifier to each property. `Pick<T, K>` is `{ [P in K]: T[P] }` where `K extends keyof T` — it iterates only over the keys in `K` (a subset of `T`'s keys) and copies each corresponding value type across. Both are ordinary generic mapped types shipped as part of TypeScript's standard type library — no special compiler magic beyond the general mapped-type mechanism. See [mapped-types.md](./mapped-types.md) and [utility-types.md](./utility-types.md).

**4. When would you reach for a generic instead of a union type? (Intermediate/Advanced)**
Use a union when a value could legitimately be one of a small, fixed set of *different* types with different handling per branch (e.g., `string | number` where you branch on `typeof`). Use a generic when you need to *preserve a relationship* between an input type and an output type across a function/structure — e.g., "return the exact same type I was given" (`identity<T>(x: T): T`) or "an array of whatever type was passed in" (`Box<T>`). A union describes "could be any of these"; a generic describes "adapts to, and remembers, whatever type you give it." See [generics.md](./generics.md) and [union-types.md](./union-types.md).

**5. What's the difference between an interface and a type alias, and when would you use each? (Intermediate)**
For plain object shapes, they're functionally interchangeable under structural typing. The real differences: interfaces support declaration merging (redeclaring the same name combines members) and `extends`; type aliases can describe non-object types (unions, tuples, conditional/mapped types) that interfaces cannot express at all, but cannot be redeclared. Convention: use `interface` for extensible object/class contracts, `type` for everything else. See [interfaces-vs-type-aliases.md](./interfaces-vs-type-aliases.md).

**6. What is a discriminated union, and why is it more type-safe than an object with optional properties? (Intermediate/Advanced)**
A discriminated union is a union of object types sharing one literal-typed "tag" property whose value uniquely identifies each variant. Checking the tag (in a `switch`/`if`) narrows the compiler's understanding of the *entire* object, making every other variant-specific property safely accessible. An object with many optional properties instead allows logically invalid combinations (e.g., a "loading" state with a populated "error" field) that a discriminated union makes structurally impossible to construct. See [discriminated-unions.md](./discriminated-unions.md).

**7. How does TypeScript handle variance for function parameters versus array elements? (Advanced)**
Array elements, object properties, and function return types are covariant — `Dog[]` is assignable to `Animal[]` when `Dog extends Animal`, matching intuition. Function parameter types are, for full soundness, supposed to be contravariant, but TypeScript checks them bivariantly by default for method syntax (a deliberate, pragmatic trade-off). The `strictFunctionTypes` flag tightens *standalone function type* checking to proper contravariance, though method-shorthand syntax remains bivariant regardless — a well-known asymmetry. See [type-compatibility-and-variance.md](./type-compatibility-and-variance.md).

**8. What does `strictNullChecks` do, and why is it considered the single most valuable strict sub-flag? (Beginner/Intermediate)**
Without it, `null` and `undefined` are silently assignable to every type, hiding one of the most common real-world bug categories. With it enabled, they must be explicitly included in a type's union (`string | null`), and the compiler forces you to handle the nullish case before use — directly preventing "cannot read property of undefined"-style runtime errors at compile time. See [strict-mode.md](./strict-mode.md).

**9. What's the difference between `??` and `||` for default values? (Beginner)**
`??` (nullish coalescing) only falls back when the left side is specifically `null`/`undefined`. `||` falls back for *any* falsy value, including `0`, `""`, and `false` — incorrectly overriding legitimate falsy values. `count ?? 10` correctly preserves `count` when it's `0`; `count || 10` incorrectly substitutes `10`. See [optional-chaining-and-nullish-coalescing.md](./optional-chaining-and-nullish-coalescing.md).

**10. Explain the `keyof` operator and how it pairs with generic constraints. (Intermediate)**
`keyof T` produces a union of `T`'s property names as literal types. Paired with a generic constraint (`K extends keyof T`), it lets you write a function that safely accepts "any valid key of this object" — `function getProperty<T, K extends keyof T>(obj: T, key: K): T[K]` — checked at compile time against the object's actual keys, with the precise return type inferred via indexed access (`T[K]`). See [keyof-operator.md](./keyof-operator.md) and [generic-constraints.md](./generic-constraints.md).

**11. What is a conditional type, and what does `infer` do inside one? (Advanced)**
A conditional type (`T extends U ? X : Y`) expresses type-level branching based on whether `T` is assignable to `U`. `infer` introduces a new type variable bound to whatever type is matched at a specific position within the `extends` clause, letting you pattern-match into and extract a piece of a larger type — e.g., `T extends (...args: any[]) => infer R ? R : never` extracts a function's return type, which is literally how the built-in `ReturnType<T>` is implemented. See [conditional-types.md](./conditional-types.md).

**12. Does TypeScript's `private` keyword provide real runtime privacy? (Intermediate)**
No — like all TypeScript-specific syntax, `private` is erased entirely at compile time; the emitted JavaScript field is a normal, fully accessible property. For genuine runtime-enforced privacy, use native ECMAScript `#private` fields, which the JS engine itself blocks external access to with a real `SyntaxError`. See [access-modifiers.md](./access-modifiers.md).

**13. When would you use an abstract class instead of an interface? (Intermediate/Advanced)**
When you need genuine shared, inherited implementation (real method bodies) alongside a contract for members that must vary per subclass — interfaces can only describe a shape with zero implementation. Abstract classes also only support single inheritance (`extends` one class), while interfaces support implementing many at once — a key practical trade-off. See [interfaces-vs-abstract-classes.md](./interfaces-vs-abstract-classes.md).

**14. What's the difference between legacy `experimentalDecorators` and the new TC39 Stage 3 decorators? (Advanced)**
They're two non-interchangeable implementations. Legacy decorators (enabled via a `tsconfig.json` flag, used by Angular/NestJS/TypeORM) receive positional arguments like `(target, propertyKey, descriptor)` and support parameter decorators. Standard TC39 decorators (native in TypeScript 5.0+, no flag needed) receive a uniform `(value, context)` pair and do not support parameter decorators at all — code written for one system does not work under the other. See [decorators.md](./decorators.md).

**15. What does `as const` do, and how does it relate to literal widening? (Intermediate)**
By default, TypeScript widens literal types in most contexts (a `let` variable, an object property) assuming future reassignment/mutation. `as const` overrides this, recursively inferring the narrowest literal type for every value and marking objects/arrays `readonly` — the standard way to derive a union type from an array of literals (`(typeof arr)[number]`) without duplicating it as a separate type declaration. See [const-assertions.md](./const-assertions.md).

**16. Why might a fast dev-server rebuild not catch a type error that `tsc` would? (Advanced)**
Tools like esbuild, swc, and Babel's TypeScript preset are "transpile-only" — they strip types and transform syntax file-by-file for speed, without running the full type checker (which needs whole-program knowledge). A type error can pass straight through such a build with zero warning. Real-world setups run `tsc --noEmit` as a separate step (CI, pre-commit, or the editor) to still catch type errors, decoupled from the fast build path. See [compiling-typescript.md](./compiling-typescript.md).

**17. How would you type-check a plain `.js` file without renaming it to `.ts`? (Intermediate)**
Enable `allowJs` and `checkJs` in `tsconfig.json` (or add `// @ts-check` at the top of an individual file), then annotate the file using JSDoc comments (`/** @param {string} name */`), which TypeScript recognizes as equivalent to real type annotations for checking purposes — a common, low-friction step in incrementally migrating a JavaScript codebase. See [typescript-with-javascript-interop.md](./typescript-with-javascript-interop.md).

**18. What is declaration merging, and how is it used to augment a third-party library's types? (Advanced)**
If the same interface name is declared more than once in the same scope, TypeScript automatically merges every declaration's members into one. This is exploited deliberately for module augmentation — e.g., `declare global { namespace Express { interface Request { user?: MyUser; } } }` merges a custom `user` property into Express's own `Request` interface without touching Express's source. This only works for interfaces, never `type` aliases, which cannot be redeclared. See [module-augmentation.md](./module-augmentation.md).

**19. What's a known type-safety gap with numeric enums specifically? (Intermediate)**
Any arbitrary number is assignable to a numeric enum's type without a compile error (`let d: Direction = 999;` compiles even if `Direction` only defines 0-3), unlike string enums or literal unions, which correctly reject out-of-range values. This is one reason many teams prefer a `const` object + derived literal union (or string enums) over numeric enums. See [enums.md](./enums.md).

**20. Why would you use `unknown` for a `catch` block's error, and how do you safely work with it? (Intermediate/Advanced)**
Modern TypeScript types caught errors as `unknown` by default (rather than the historically loose `any`), since a `throw` statement can technically throw any value, not just an `Error`. You must narrow it before use — typically `if (error instanceof Error) { console.log(error.message); }` — which correctly forces handling of the case where something non-`Error` was thrown, instead of blindly assuming `.message` exists. See [any-unknown-never-void.md](./any-unknown-never-void.md) and [type-guards-and-narrowing.md](./type-guards-and-narrowing.md).

## How to Use This Folder

Work through the sections roughly in the order listed above — each builds conceptually on the last:

1. **Fundamentals & Types** first — basic types, `any`/`unknown`/`never`/`void`, literal types, and structural typing are the vocabulary everything else is written in.
2. **Interfaces & Type Aliases** next — shaping objects, unions, and discriminated unions is the most-used part of everyday TypeScript and a near-guaranteed interview focus.
3. **Functions & Generics** after that — generics are a prerequisite for understanding almost every "advanced types" feature that follows, since mapped/conditional/utility types are all generics applied at the type level.
4. **Classes & OOP** can be read in parallel with the above — it's largely self-contained, though it leans on interfaces and generics for full understanding of access patterns and typed class hierarchies.
5. **Advanced Types** (`keyof`, `typeof`, mapped types, conditional types, utility types, narrowing) is best read once generics and interfaces feel solid — this section is where TypeScript's type system stops looking like "JavaScript plus annotations" and starts looking like its own small, composable programming language.
6. **Modules & Project Config** and **Interop & Tooling** last — `tsconfig.json`, strict mode, module systems, and build tooling matter enormously in real projects but are best understood once you already know *what* you're configuring the compiler to check.

For interview prep specifically: skim each file's own "Interview Questions & Answers" section first for a fast per-topic refresher, then use the "Curated" list above as a cross-cutting mock-interview pass once the individual topics feel solid — it's deliberately built from the questions most likely to come up regardless of which specific topic an interviewer starts from.
