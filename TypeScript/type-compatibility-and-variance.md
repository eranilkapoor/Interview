# Type Compatibility / Variance in TS

Type compatibility is the question TypeScript answers every time it checks whether a value of one type can be used where another type is expected — "is `A` assignable to `B`?" Because TypeScript is structurally typed (see [structural-typing.md](./structural-typing.md)), this check is fundamentally about shape: `A` is assignable to `B` if `A` has at least every member `B` requires, with compatible types for each. A type with *more* members than required (a "wider," more specific type) is generally assignable to a type expecting *fewer* members (a "narrower" requirement, ironically often called the "supertype" in subtyping terms) — this is the basic subtype relationship almost everything else builds on.

**Variance** describes how compatibility behaves when types are *nested* inside a generic structure like an array, a function parameter, or an object property — does `Container<Dog>` remain assignable to `Container<Animal>` just because `Dog` is assignable to `Animal`? TypeScript's answer differs by position: object properties, array elements, and function **return types** are **covariant** — they follow the same direction as the underlying types (`Dog[]` is assignable to `Animal[]`, mirroring `Dog` being assignable to `Animal`), which matches most developers' intuition. Function **parameter types**, however, are technically supposed to be **contravariant** for full soundness — a function is only safely substitutable if it accepts everything the expected function type could throw at it, meaning a function accepting a *wider* parameter type should be assignable where a *narrower* one is expected, the *reverse* direction.

In practice, TypeScript relaxes this and checks function parameters **bivariantly** by default for method syntax (allowing both directions, matching most other mainstream typed languages' more permissive, pragmatic behavior, and how JavaScript codebases are actually often written) — this is a deliberate, documented trade-off between full soundness and everyday ergonomics. The `strictFunctionTypes` flag (part of `strict` mode) tightens this specifically for *standalone function type* expressions (not methods) to properly contravariant checking, catching a real (if relatively rare) category of unsound assignment that bivariant checking would otherwise silently allow — the asymmetry between method syntax and function-property syntax under this flag is itself a well-known, interview-relevant TypeScript quirk.

Understanding variance mainly matters for correctly reasoning about generic APIs, callback parameter safety, and occasionally debugging a confusing "assignable" or "not assignable" error involving function types nested inside another generic type — for everyday application code, TypeScript's defaults are tuned to feel intuitive without requiring you to consciously track variance directionality most of the time.

## Examples

```ts
// Basic structural compatibility — "has at least what's required" is assignable
interface Named { name: string; }
const dog = { name: "Rex", breed: "Labrador" };
const named: Named = dog; // OK — dog has more than Named requires, which is fine
```

```ts
// Covariance: array/property types follow the same direction as their element types
class Animal { move() {} }
class Dog extends Animal { bark() {} }

let animals: Animal[];
let dogs: Dog[] = [new Dog()];
animals = dogs; // OK — Dog[] is assignable to Animal[] (covariant), matches intuition
```

```ts
// Function parameter (contra)variance and strictFunctionTypes
type AnimalHandler = (a: Animal) => void;
type DogHandler = (d: Dog) => void;

let handleAnimal: AnimalHandler = (a) => console.log(a);
let handleDog: DogHandler;

// Contravariantly, a function taking the WIDER type (Animal) should be assignable
// where a function taking the NARROWER type (Dog) is expected — since it can handle any Dog too:
handleDog = handleAnimal; // OK — handleAnimal can safely process any Dog (a Dog IS an Animal)

// With "strictFunctionTypes": true, TypeScript checks standalone function type variables like this
// properly contravariantly; method-shorthand syntax on an interface/class is still checked
// bivariantly (more permissively) regardless of this flag — a well-known asymmetry.
```

## Common Pitfalls / Gotchas

- Assuming TypeScript checks generic type parameters bivariantly (permissively) everywhere by default — this specific leniency mainly applies to method-syntax function parameters; `strictFunctionTypes` tightens standalone function-type-variable assignments to proper (safer) contravariant checking.
- Being surprised that method-shorthand syntax (`interface Foo { doIt(x: Dog): void }`) and function-property syntax (`interface Foo { doIt: (x: Dog) => void }`) behave differently under `strictFunctionTypes` even though they look nearly identical — this asymmetry is a real, deliberate TypeScript design choice, not a bug, rooted in common real-world patterns (like array method callbacks) that would otherwise be over-restricted.
- Forgetting that "wider" and "narrower" can be confusing terminology — a type with *more required members* is actually the more specific/narrower *subtype*, assignable to a type with *fewer* required members (the wider/more general supertype) — it's easy to get this backwards when reasoning aloud.
- Not realizing readonly arrays interact with variance differently than mutable arrays in some edge cases — a mutable `Dog[]` being treated as `Animal[]` technically allows unsound insertion of a non-`Dog` `Animal` into what's actually a `Dog[]` at runtime; TypeScript accepts this known unsoundness as a pragmatic trade-off (a longstanding, intentional gap, not an oversight).

## Interview Questions & Answers

**Q: What does "structural type compatibility" mean, and how does it determine whether `A` is assignable to `B`?**
A: `A` is assignable to `B` if `A`'s shape has at least every member `B` requires, with compatible types for each — the check is based purely on structure/shape, not on any declared relationship (like `implements` or `extends`) between the two types.

**Q: What is variance, and why does it matter for generic types like arrays or function parameters?**
A: Variance describes how the assignability relationship between two types propagates when they're nested inside a generic structure. Array elements and object properties are covariant (matching the direction of the underlying types' relationship), while function parameters are, for full type-system soundness, supposed to be contravariant (the reverse direction) — getting this wrong is a common source of unsound-seeming, or confusingly rejected, assignments involving callbacks.

**Q: What does `strictFunctionTypes` change, and why doesn't it affect every function-type check the same way?**
A: It makes standalone function type variables/parameters checked properly contravariantly instead of the default, more permissive bivariant checking. It deliberately does *not* apply the same strictness to method-shorthand syntax (`method(x: T): void` inside an interface/class), because bivariant method checking matches common, broadly-used JavaScript patterns (like array callback methods) that would otherwise be overly restricted — a known, intentional asymmetry in TypeScript's design.

**Q: Is `Dog[]` assignable to `Animal[]` if `Dog extends Animal`? Is this fully sound?**
A: Yes, it's assignable (arrays are covariant in their element type) — but it's a known, accepted unsoundness: since the resulting `Animal[]` reference is still the same underlying mutable array, code holding that reference could theoretically insert a different `Animal` subtype into what's actually still a `Dog[]` at runtime. TypeScript accepts this trade-off deliberately for ergonomics, rather than requiring cumbersome readonly-everywhere array typing by default.

## Related Topics
- [structural-typing.md](./structural-typing.md)
- [generics.md](./generics.md)
- [functions-in-typescript.md](./functions-in-typescript.md)
- [strict-mode.md](./strict-mode.md)
- [interfaces.md](./interfaces.md)
