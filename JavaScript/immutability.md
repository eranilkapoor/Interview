# Immutability

Immutability means a value cannot be changed after it's created — any "modification" instead produces a brand-new value, leaving the original untouched. JavaScript's primitive values (`string`, `number`, `boolean`, `null`, `undefined`, `symbol`, `bigint`) are inherently immutable at the language level: there is no way to change the bits of the primitive `5` or the string `"hi"` in place. Objects and arrays, by contrast, are mutable by default — their properties/elements can be changed, added, or removed after creation while the object's identity (reference) stays the same.

Immutability matters practically for predictability and performance in several contexts: React and other UI frameworks rely on treating state as immutable so they can detect changes via cheap reference-equality checks (`prevState !== nextState`) instead of expensive deep comparisons; functional programming style favors returning new data over mutating shared data to avoid hidden side effects and make functions easier to reason about and test; and undo/redo or time-travel debugging features are far simpler to implement when each state is a distinct, never-mutated snapshot.

JavaScript provides `Object.freeze()` to make an object's *own, top-level* properties immutable (attempts to change them fail silently in non-strict mode, or throw a `TypeError` in strict mode) — but this is only a **shallow** freeze; nested objects inside a frozen object remain fully mutable unless you recursively freeze them too. True deep immutability typically requires either a recursive freeze utility, a library (Immer, Immutable.js), or structural techniques like always spreading/cloning before mutating (a discipline, not a language guarantee).

## Examples

```js
// Primitives are immutable by nature; objects are not
let str = 'hello';
str.toUpperCase(); // returns a NEW string, doesn't mutate str
console.log(str); // "hello" — unchanged

const obj = { count: 1 };
obj.count = 2; // mutates the object in place — its reference stays the same
console.log(obj); // { count: 2 }
```

```js
// Object.freeze() — shallow immutability only
const config = Object.freeze({ theme: 'dark', nested: { retries: 3 } });
config.theme = 'light';           // silently fails (or throws in strict mode)
config.nested.retries = 10;       // SUCCEEDS — nested objects are not frozen!
console.log(config); // { theme: 'dark', nested: { retries: 10 } }
```

```js
// The immutable-update pattern: create new data instead of mutating
function addItem(cart, item) {
  return [...cart, item]; // new array, original `cart` untouched
}
const original = ['apple'];
const updated = addItem(original, 'banana');
console.log(original); // ['apple'] — unaffected
console.log(updated);  // ['apple', 'banana']
```

## Common Pitfalls / Gotchas

- Assuming `Object.freeze()` deeply freezes an object — it only freezes the top level; nested objects/arrays remain fully mutable unless explicitly frozen too.
- Confusing `const` with immutability — `const` only prevents *reassigning the variable*; the object it points to can still be mutated freely.
- Mutating state directly in frameworks (like React) that expect immutable updates — this breaks reference-equality change detection, causing missed re-renders or stale UI.
- Believing spread (`{...obj}`) or `Array.prototype.slice()` produce deep copies — they're shallow; nested references are shared between the "copy" and the original.

## Interview Questions & Answers

**Q: What's the difference between `const` and immutability?**
A: `const` prevents reassigning the *variable binding* — you can't point it at a new value. It says nothing about whether the *value itself* (if it's an object/array) can be mutated; `const arr = []; arr.push(1);` is entirely legal. True immutability requires additional measures like `Object.freeze()` or an immutable-by-convention coding style.

**Q: Why do UI frameworks like React care about immutability?**
A: React (and similar frameworks) determine whether to re-render by comparing previous and next state/props, often via cheap reference equality (`===`) rather than expensive deep equality. If state is updated immutably (a new object/array is created on each change), a changed reference reliably signals "something changed." If state is mutated in place, the reference stays the same even though the data changed, causing the framework to incorrectly skip a needed re-render.

**Q: Does `Object.freeze()` produce deep immutability?**
A: No — it's shallow. It locks the object's own top-level properties (making them non-writable, non-configurable), but any nested object referenced by a property remains fully mutable unless you recursively freeze it as well.

**Q: How would you deep-clone an object to avoid shared-reference mutation bugs?**
A: `structuredClone(obj)` (modern, built-in, handles most types including dates/maps/sets, but not functions), `JSON.parse(JSON.stringify(obj))` (simple but loses functions, `undefined`, `Date` objects become strings, and can't handle circular references), or a dedicated deep-clone/immutable-update library (Lodash's `cloneDeep`, Immer).

## Related Topics
- [let-and-const.md](./let-and-const.md)
- [pass-by-reference.md](./pass-by-reference.md)
- [spread-operator.md](./spread-operator.md)
- [pure-function.md](./pure-function.md)
- [functional-programing.md](./functional-programing.md)
