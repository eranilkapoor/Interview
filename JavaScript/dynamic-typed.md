# Dynamically Typed

JavaScript is a dynamically typed language: a variable itself has no fixed type — it's simply a binding that can hold a value of any type at any time, and the type is resolved at **runtime** based on whatever value currently occupies the variable. This contrasts with statically typed languages, where a variable's type is fixed (declared or inferred) at compile time and checked before the program runs (see [static-typed.md](./static-typed.md)).

Dynamic typing gives JavaScript significant flexibility: the same variable can hold a number, then later a string, then an object, with no declaration changes required, and functions can accept/return values of varying shapes without generic/overload boilerplate. This flexibility is a double-edged sword in interviews and in practice — it enables rapid prototyping and duck-typing (caring about what a value *can do* rather than its declared type), but it also means type-related bugs (calling `.toUpperCase()` on a number, or iterating over `undefined`) only surface when the offending line actually executes, potentially in production.

Dynamic typing is orthogonal to "weak" vs "strong" typing (how permissive the language is about implicit coercions). JavaScript is both dynamically typed *and* weakly typed, meaning it not only resolves types at runtime but also freely coerces between types in many operators (`+`, `==`), which is a major source of the "JavaScript is weird" jokes and a frequent interview topic (see [type-coercion.md](./type-coercion.md)).

## Examples

```js
// A variable's type can change freely at runtime
let value = 42;
console.log(typeof value); // "number"
value = 'now a string';
console.log(typeof value); // "string"
value = { now: 'an object' };
console.log(typeof value); // "object"
```

```js
// Dynamic typing enables duck-typing: no declared "type" required
function describeAnimal(animal) {
  if (typeof animal.speak === 'function') {
    return animal.speak();
  }
  return 'This animal cannot speak';
}
console.log(describeAnimal({ speak: () => 'Woof!' })); // "Woof!"
console.log(describeAnimal({ name: 'Rock' }));          // "This animal cannot speak"
```

```js
// A type-related bug only surfaces at runtime, not before
function getLength(value) {
  return value.length; // assumes value has .length
}
console.log(getLength('hello')); // 5
console.log(getLength(42));      // undefined — no compile-time warning that this is wrong
```

## Common Pitfalls / Gotchas

- Treating dynamic typing as an excuse to skip input validation — functions silently accept the wrong shape of data and fail (or worse, produce wrong results) far from where the bad value originated.
- Confusing "dynamically typed" with "untyped" — every value still has a well-defined type; it's just not checked or declared ahead of time.
- Refactoring a function's expected argument shape without updating every call site — there's no compiler to catch mismatches, only tests (or production incidents) will.
- Over-relying on `typeof`/duck-typing checks scattered through code instead of centralizing validation (or adopting TypeScript/runtime schema validation) in larger codebases.

## Interview Questions & Answers

**Q: What does it mean for JavaScript to be dynamically typed?**
A: Types are associated with values, not variables, and are checked at runtime rather than compile time. A variable can be reassigned to hold a value of a completely different type at any point in the program with no special syntax required.

**Q: Is JavaScript both dynamically and weakly typed? What's the difference between those two properties?**
A: Yes to both, but they're independent axes. "Dynamically typed" is about *when* types are checked (runtime vs compile time). "Weakly typed" is about *how strict* the language is about implicit conversions between types (JS freely coerces types in `+`, `==`, conditionals, etc.). A language could be dynamically typed but strongly typed (like Python, which raises errors on most implicit cross-type operations) or statically typed but weakly typed.

**Q: What's a practical risk of dynamic typing in large codebases, and how do teams mitigate it?**
A: Type-related bugs surface only when the offending code path actually executes, which can be in production rather than during development. Teams mitigate this with static analysis layers like TypeScript, thorough automated tests, runtime schema validation (e.g., for API boundaries), and JSDoc type annotations checked by tsc in "checkJs" mode.

## Related Topics
- [static-typed.md](./static-typed.md)
- [type-coercion.md](./type-coercion.md)
- [types-in-javascript.md](./types-in-javascript.md)
- [datatypes-in-javascript.md](./datatypes-in-javascript.md)
