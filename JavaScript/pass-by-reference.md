# Pass by Reference

When an object (including arrays and functions) is assigned to a new variable or passed as a function argument, JavaScript copies the **reference** to that object — not the object's contents. Both the original and the new variable now point to the exact same underlying object in memory. This means mutating the object's properties through either variable is visible through the other, because there's genuinely only one object; there are just two "handles" pointing at it.

This is often loosely called "pass by reference," but the more precise term used by language theorists is "call by sharing": JavaScript copies the reference *by value* (the reference itself is a value being copied), which is subtly different from true pass-by-reference in languages like C++ (where a function can reassign the caller's original variable itself). In JavaScript, a function can mutate an object it receives, but it can never make the caller's variable point to a *different* object — reassigning the local parameter only changes what the local parameter points to, leaving the caller's original binding untouched.

This distinction — "mutating through a shared reference" vs "reassigning a binding" — is the single most important nuance for correctly predicting object-related bugs in JavaScript, and is one of the highest-value concepts to be able to explain precisely and confidently in an interview.

## Examples

```js
// Mutating an object's properties through a function is visible to the caller
function addAge(person) {
  person.age = (person.age || 0) + 1; // mutates the SAME object
}
const user = { name: 'Anil', age: 29 };
addAge(user);
console.log(user.age); // 30 — visible outside the function
```

```js
// Reassigning the parameter to a NEW object does NOT affect the caller's variable
function replaceUser(person) {
  person = { name: 'Someone Else' }; // rebinds the LOCAL parameter only
}
const user2 = { name: 'Anil' };
replaceUser(user2);
console.log(user2.name); // "Anil" — unaffected; the caller's binding never changed
```

```js
// Two variables sharing one object — classic reference-aliasing bug
const original = { items: [1, 2, 3] };
const alias = original; // NOT a copy — same object
alias.items.push(4);
console.log(original.items); // [1, 2, 3, 4] — original changed too, since it's the same object
```

## Common Pitfalls / Gotchas

- Assuming `const obj2 = obj1;` creates an independent copy — it doesn't; both variables reference the same object, so mutating one is visible through the other.
- Expecting a function to "return" a mutated object back to the caller via reassignment of its parameter — reassigning a parameter inside a function never affects the caller's original variable; only mutating the shared object's properties does.
- Forgetting that array/object methods that mutate in place (`push`, `splice`, `sort`, direct property assignment) affect every reference to that object, which can silently break code elsewhere that didn't expect the shared object to change.
- Passing an object into a function assuming it will be "safe" from modification, when the function actually mutates it internally — always check a library/utility function's documentation (or the source) for whether it mutates its argument or returns a new value.

## Interview Questions & Answers

**Q: If you mutate an object inside a function, does the caller see the change? What if you reassign the parameter?**
A: Mutating the object's properties (e.g., `obj.x = 5`) is visible to the caller, because both the parameter and the caller's variable reference the exact same object. Reassigning the parameter itself to a completely new object (`obj = {}`) only changes what the *local parameter* points to — it has no effect on the caller's original variable, which still points to the original object.

**Q: Why is "call by sharing" a more accurate term than "pass by reference" for how JS handles objects?**
A: True pass-by-reference (as in C++ with `&`) would let a function reassign the caller's original variable to point somewhere else entirely. JavaScript doesn't allow that — a function can only mutate the shared object's contents, never rebind the caller's variable. "Call by sharing" precisely captures that the *reference* is what's shared/copied, while the binding itself remains protected.

**Q: How would you prevent a function from mutating an object you pass into it?**
A: Pass a copy instead of the original reference — a shallow copy via spread (`{...obj}`) or `Object.assign({}, obj)` for simple cases, or a deep clone (`structuredClone(obj)`, a deep-clone utility) if the function might mutate nested properties too. Alternatively, `Object.freeze()` the object to make mutation attempts fail (though this is shallow only).

## Related Topics
- [pass-by-value.md](./pass-by-value.md)
- [immutability.md](./immutability.md)
- [spread-operator.md](./spread-operator.md)
- [objects.md](./objects.md)
