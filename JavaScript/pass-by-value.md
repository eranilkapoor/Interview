# Pass by Value

"Pass by value" describes how primitive values (`string`, `number`, `boolean`, `null`, `undefined`, `symbol`, `bigint`) are handled when assigned to a new variable or passed as a function argument in JavaScript: the value itself is **copied**. The new variable/parameter is a completely independent copy — changing it has zero effect on the original variable, because they no longer share any connection after the copy is made.

This is straightforward and matches most beginners' intuitions, but it's often taught alongside (and confused with) "pass by reference" for objects — which is *not* quite the same mechanism, even though objects "feel" mutable across function boundaries. The correct, precise mental model for JS is: **primitives are copied by value; object references are copied by value too** — but what gets copied for an object is the *reference* (the memory address/handle), not the object's contents. So mutating the object's properties through that copied reference *is* visible to the original, while reassigning the parameter to a whole new object is not (see [pass-by-reference.md](./pass-by-reference.md) for the full nuance).

Understanding pass-by-value correctly for primitives is foundational for reasoning about function side effects: a function can never accidentally change a `number` or `string` variable that a caller passed in, no matter what it does to its local parameter — this is one of the most reliable "safety guarantees" a JS interview candidate should be able to state confidently.

## Examples

```js
// Primitive reassignment inside a function has no effect on the caller's variable
function incrementByValue(n) {
  n = n + 1;
  return n;
}
let age = 30;
const newAge = incrementByValue(age);
console.log(age, newAge); // 30 31 — original untouched
```

```js
// Copying a primitive to a new variable creates a fully independent value
let a = 'hello';
let b = a; // copies the value
b = 'world';
console.log(a, b); // "hello" "world"
```

```js
// Even mutating-looking string operations don't affect the original — strings are immutable & copied by value
function shout(message) {
  message = message.toUpperCase();
  return message;
}
let greeting = 'hi';
console.log(shout(greeting)); // "HI"
console.log(greeting);        // "hi" — untouched
```

## Common Pitfalls / Gotchas

- Assuming a function can mutate a caller's primitive by reassigning its local parameter — it can't; the parameter is an independent copy, disconnected from the caller's variable.
- Confusing pass-by-value for primitives with the behavior of objects — objects are also technically "passed by value," but the value being copied is a *reference*, which leads to different (and often confusing) mutation behavior.
- Believing JavaScript has any true "pass by reference" mechanism (like C++'s `&` references) that would let a function reassign the caller's variable itself — it does not; JS has no such mechanism for any type.

## Interview Questions & Answers

**Q: Is JavaScript pass-by-value or pass-by-reference?**
A: Strictly speaking, JavaScript is always pass-by-value — but for objects, the "value" being copied is a *reference* to the object, not the object's contents. This is sometimes called "pass by reference of the value" or "call by sharing." Primitives are copied outright; objects have their reference copied, which is why mutating an object's properties inside a function is visible outside, but reassigning the parameter to a new object is not.

**Q: If you pass a number into a function and change it inside, does the caller see the change?**
A: No. Numbers (and all primitives) are copied by value; the function's parameter is a fully independent copy. Any reassignment inside the function only affects that local copy.

**Q: Can a JavaScript function ever change what variable a caller's variable points to (true reference semantics)?**
A: No — JavaScript has no mechanism (like C++ references or pointers) that lets a callee reach back and rebind the caller's variable itself. A function can only mutate the contents of an object it receives (if it has a reference to one), never reassign the caller's original binding.

## Related Topics
- [pass-by-reference.md](./pass-by-reference.md)
- [primitive-types.md](./primitive-types.md)
- [datatypes-in-javascript.md](./datatypes-in-javascript.md)
- [immutability.md](./immutability.md)
