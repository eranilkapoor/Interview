# Structural Typing / Duck Typing in TS

TypeScript uses a **structural** type system: two types are considered compatible if they have the same *shape* — the same members with compatible types — regardless of how (or whether) they're formally declared to be related. This is often summarized as "duck typing at compile time": if it walks like a duck and quacks like a duck, TypeScript treats it as a duck, whether or not it was ever explicitly declared as one. This contrasts with **nominal** typing (used by languages like Java, C#, and Swift), where two types are only compatible if one explicitly declares itself to `implement`/`extends` the other — matching shape alone isn't enough; the declaration itself must say so.

The practical consequence is that an object literal, or an instance of a completely unrelated class, can be passed anywhere an interface is expected as long as it has all the required properties with compatible types — no `implements` keyword needed. This is what makes TypeScript feel so natural on top of JavaScript, a language with no nominal type declarations at all: rather than forcing every object to formally declare its type membership, TypeScript infers compatibility purely from the members present.

Structural typing does have a well-known safety valve: **excess property checks**. When you pass an object *literal* directly to a place expecting a certain type, TypeScript additionally flags any extra properties the literal has that aren't in the target type — even though structurally the literal is still a valid supertype-match otherwise. This check exists specifically to catch typos (e.g., `nam` instead of `name`) that pure structural compatibility would otherwise let slide, since the "extra" `nam` property wouldn't make it match. This check only applies to object literals assigned directly, not to variables holding a pre-existing object of a wider type — those pass through unchecked (the object could have extra properties, and that's fine structurally).

Because two structurally identical types are always interchangeable, TypeScript offers "branding" or "nominal typing emulation" for cases where you genuinely want two same-shaped types to be treated as distinct (e.g., a `UserId` string vs an `OrderId` string) — typically via an unused, uniquely-named `readonly __brand` property that has no runtime cost but breaks structural equivalence between otherwise-identical primitive-based types.

## Examples

```ts
// Structural compatibility — no explicit relationship declared, but the shape matches
interface Point {
  x: number;
  y: number;
}
function printPoint(p: Point) {
  console.log(`(${p.x}, ${p.y})`);
}
class Vector {
  constructor(public x: number, public y: number) {}
} // Vector never says "implements Point" — but it matches Point's shape
printPoint(new Vector(3, 4)); // Works fine: structurally compatible
printPoint({ x: 1, y: 2 });    // Also works: plain object literal, same shape
```

```ts
// Excess property check — only fires for object literals assigned/passed directly
function greet(person: { name: string }) {
  console.log(`Hello, ${person.name}`);
}
// greet({ name: "Anil", nam: "typo" }); // Compile error: 'nam' does not exist in type
const p = { name: "Anil", nam: "typo" };
greet(p); // OK — no excess property check on a variable, only on a literal passed directly
```

```ts
// Emulating nominal typing with a "brand" — for otherwise structurally identical types
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

function getUser(id: UserId) { /* ... */ }
declare const orderId: OrderId;
// getUser(orderId); // Compile error — brands differ, even though both are ultimately `string`
```

## Common Pitfalls / Gotchas

- Assuming an object must formally `implement` an interface to be usable as that interface's type — under structural typing, any shape-compatible object or class instance works, with no `implements` clause required at all.
- Forgetting the excess property check only applies to object literals passed directly — assigning the literal to a variable first, then passing the variable, silently bypasses the check, letting a typo'd extra property through undetected.
- Expecting two different types with identical shapes (e.g., two separate `string`-based ID types) to be treated as distinct — structurally they're fully interchangeable unless you deliberately "brand" them to break that equivalence.
- Being surprised that a wider type (with extra properties beyond what's required) is freely assignable wherever the narrower shape is expected — this is exactly what structural typing intends (a form of implicit "is-a" via shape), not a bug.

## Interview Questions & Answers

**Q: What does it mean that TypeScript is structurally, not nominally, typed?**
A: Type compatibility is determined by comparing member shapes (property names and their types), not by explicit declared relationships. Any value with a compatible shape can be used wherever that type is expected, even if it was never declared to `implement` or `extend` that type — unlike nominal systems (Java, C#) where an explicit declaration is required regardless of shape.

**Q: What are excess property checks, and why do they exist if TypeScript is structurally typed?**
A: They're an extra check applied only when an object *literal* is passed or assigned directly to a target type — if the literal has properties not present in the target type, TypeScript flags an error, even though a pre-existing variable with the same shape would pass fine. They exist specifically to catch likely typos in object literals that pure structural matching would otherwise silently allow.

**Q: If structural typing means any shape-compatible object works, why would you ever need a "branded type"?**
A: When you want to prevent two otherwise-identical-shaped types (e.g., two different string-based IDs) from being accidentally interchanged, even though structurally they're the same type. Adding a unique, unused `__brand` property forces the types to diverge structurally, effectively emulating nominal typing for that specific case.

**Q: Does structural typing apply to classes as well as interfaces/object types?**
A: Yes — a class instance is compatible with any interface or object type whose member shape it satisfies, regardless of whether the class declares `implements` for that interface. `implements` in TypeScript is mainly a compiler-checked documentation/intent signal (and catches missing members immediately at the class declaration), not a requirement for structural compatibility elsewhere.

## Related Topics
- [interfaces.md](./interfaces.md)
- [type-compatibility-and-variance.md](./type-compatibility-and-variance.md)
- [interfaces-vs-type-aliases.md](./interfaces-vs-type-aliases.md)
- [classes-in-typescript.md](./classes-in-typescript.md)
- [type-guards-and-narrowing.md](./type-guards-and-narrowing.md)
