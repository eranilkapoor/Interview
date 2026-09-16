# Private vs Public (Class Members)

"Public" members of a class or object are accessible from anywhere — any code with a reference to the instance can read/call them freely. "Private" members are intended to be accessible only from *within* the class/object itself, hiding implementation details and preventing external code from depending on (or corrupting) internal state directly — a core part of encapsulation (see [oop-concepts.md](./oop-concepts.md)).

JavaScript has evolved several approaches to privacy, with genuinely different levels of enforcement. The oldest, weakest approach is a **naming convention** — prefixing a property with an underscore (`_balance`) to *signal* "please don't touch this directly," but the engine does nothing to actually stop external access; it's purely a social contract between developers. A stronger, genuinely enforced approach predating native private fields is using **closures** — declaring the "private" data as a local variable inside a constructor/factory function, accessible only to methods defined within that same closure, with no way for outside code to reach it at all. The modern, standardized, and now-preferred approach is **native private class fields and methods** (`#fieldName`, ES2022) — the `#` prefix is enforced by the JavaScript engine itself: attempting to access `instance.#field` from outside the class is a `SyntaxError`, not just a discouraged pattern.

Understanding *why* the language added native private fields, given closures already provided genuine privacy, comes down to ergonomics and consistency with `class` syntax: closures require a factory-function pattern rather than `class`, don't play as naturally with `this`, and can't easily express "private" instance methods the same way public class methods are declared — `#fields`/`#methods` bring real, enforced privacy directly into the familiar `class` syntax.

## Examples

```js
// Convention-based "privacy" — NOT actually enforced
class BankAccountWeak {
  constructor(balance) { this._balance = balance; } // underscore = "please don't touch"
  deposit(amount) { this._balance += amount; }
}
const acc1 = new BankAccountWeak(100);
acc1._balance = 999999; // completely legal — the convention provides no real protection
console.log(acc1._balance); // 999999
```

```js
// Closure-based privacy — genuinely enforced, pre-dates native private fields
function createBankAccount(initialBalance) {
  let balance = initialBalance; // truly inaccessible from outside this function's scope
  return {
    deposit(amount) { balance += amount; return balance; },
    getBalance() { return balance; }
  };
}
const acc2 = createBankAccount(100);
console.log(acc2.getBalance()); // 100
console.log(acc2.balance);       // undefined — no such property exists on the returned object
```

```js
// Native private class fields (#) — enforced directly by the engine (ES2022)
class BankAccountStrong {
  #balance; // private field declaration
  constructor(balance) { this.#balance = balance; }
  #validate(amount) { if (amount < 0) throw new Error('Invalid amount'); } // private method
  deposit(amount) { this.#validate(amount); this.#balance += amount; return this.#balance; }
  getBalance() { return this.#balance; }
}
const acc3 = new BankAccountStrong(100);
console.log(acc3.getBalance()); // 100
// console.log(acc3.#balance); // SyntaxError: Private field '#balance' must be declared in an enclosing class
```

## Common Pitfalls / Gotchas

- Relying on underscore-prefixed properties (`_field`) for real security/privacy — they provide zero actual enforcement; any code can read or overwrite them.
- Assuming closures and `#private` fields are interchangeable in every context — closures require a factory-function pattern (no `class`/`new`, or combined awkwardly with them), while `#fields` integrate naturally with `class` syntax and support both private methods and private static members.
- Forgetting `#privateField` must be declared inside the class body before it's used (even just as `#field;` with no initializer) — referencing an undeclared `#field` is a `SyntaxError`, not a runtime error.
- Trying to access a private field from outside the class dynamically (e.g., via bracket notation or `Object.keys()`) — private fields are not accessible or enumerable by any external mechanism; `#` access is only valid from within the lexical body of the declaring class.

## Interview Questions & Answers

**Q: What are the three main approaches to "privacy" in JavaScript, and how do their enforcement levels differ?**
A: (1) Underscore naming convention — purely a social signal, zero enforcement, fully accessible externally. (2) Closures — genuine enforcement, since the private variable simply doesn't exist as a property on the returned object at all, but requires a factory-function pattern rather than `class`. (3) Native `#private` fields/methods (ES2022) — genuine, engine-enforced privacy directly within `class` syntax, throwing a `SyntaxError` on any external access attempt.

**Q: Why did JavaScript add native private class fields (`#field`) when closures already provided real privacy?**
A: Closures require abandoning (or awkwardly combining with) `class`/`new`-based constructor patterns, and don't offer a clean way to express private *methods* the same way public class methods are declared. `#fields`/`#methods` bring enforced privacy directly into idiomatic `class` syntax, with support for private instance fields, private methods, and private static members, integrating naturally with the rest of modern class-based code.

**Q: What happens if you try to access `instance.#field` from outside the class where `#field` is declared?**
A: It's a `SyntaxError` at parse time (not merely `undefined` or a runtime error) — `#`-prefixed names are only valid syntax within the lexical body of the class that declares them; using that syntax anywhere else is rejected before the code even runs.

## Related Topics
- [classes.md](./classes.md)
- [closures.md](./closures.md)
- [oop-concepts.md](./oop-concepts.md)
- [objects-in-javascript.md](./objects-in-javascript.md)
