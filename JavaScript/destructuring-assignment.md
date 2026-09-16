# Destructuring Assignment

Destructuring (ES2015) is a syntax for unpacking values from arrays or properties from objects into distinct variables in a single, concise expression, instead of accessing each element/property individually. It works for arrays (positional, based on order) and objects (named, based on property keys), and can be nested arbitrarily deep to pull values out of complex structures in one statement.

Destructuring supports default values (used when the extracted value is `undefined`), renaming (`const { name: userName } = user`), skipping elements in array destructuring (`const [ , second ] = arr`), and combining with the rest pattern (`const [first, ...rest] = arr`) to capture "everything else." It's extensively used in function parameters — destructuring an options object directly in the parameter list is one of the most common modern JS idioms for readable, self-documenting function signatures.

Destructuring is not a new data structure or operator in the traditional sense — it's pattern matching against the *shape* of the right-hand side value, applied at assignment time. Understanding exactly when it throws (e.g., destructuring `null`/`undefined` throws a `TypeError`, since there are no properties to read) versus when it silently yields `undefined` (missing properties on an otherwise valid object) is a good interview signal of depth.

## Examples

```js
// Array destructuring: order matters, skipping with commas, defaults
const list = [1, 2, 3];
let [a, , b] = list;
console.log(a, b); // 1 3

const [x = 10, y = 20] = [undefined, 5];
console.log(x, y); // 10 5 — default only applies when the value is undefined
```

```js
// Object destructuring: renaming, nested, defaults, function parameters
const user = { name: 'Anil', address: { city: 'Delhi' } };
const { name: userName, address: { city } = {} } = user;
console.log(userName, city); // "Anil" "Delhi"

function greet({ name, greeting = 'Hello' } = {}) {
  console.log(`${greeting}, ${name}`);
}
greet({ name: 'Sunita' }); // "Hello, Sunita"
```

```js
// Swapping values without a temp variable, and rest pattern
let [p, q] = [1, 2];
[p, q] = [q, p];
console.log(p, q); // 2 1

const [first, ...rest] = [10, 20, 30, 40];
console.log(first, rest); // 10 [20, 30, 40]
```

## Common Pitfalls / Gotchas

- Destructuring `null` or `undefined` directly — `const { a } = null;` throws `TypeError: Cannot destructure property 'a' of 'null' as it is null.` Always guard with a default (`= {}`) when the source might be missing.
- Confusing default values with "replace falsy" behavior — a default only kicks in when the extracted value is exactly `undefined`, not for `null`, `0`, or `''`.
- Forgetting that destructuring an object doesn't skip inherited getters — accessing a destructured property can trigger a getter with side effects, same as normal property access.
- Overusing deeply nested destructuring in function signatures, hurting readability — sometimes accessing properties explicitly inside the function body is clearer than a five-level-deep destructuring pattern.

## Interview Questions & Answers

**Q: What happens if you destructure a property that doesn't exist on the source object?**
A: The resulting variable is `undefined` (unless you provide a default value), no error is thrown — destructuring a missing *property* is safe; only destructuring from `null`/`undefined` itself throws.

**Q: How would you swap two variables using destructuring?**
A: `[a, b] = [b, a];` — the right-hand side array literal is evaluated first (capturing both original values), then array destructuring assigns them in swapped order, with no temporary variable needed.

**Q: How do default parameter values interact with destructuring in function signatures, and why is `= {}` often added?**
A: `function f({ a, b } = {})` provides a fallback empty object if the function is called with no argument at all (`f()`), preventing a `TypeError` from trying to destructure `undefined`. Without the `= {}` default, calling `f()` would throw, since there's nothing to destructure.

**Q: Can you destructure while renaming a variable and giving it a default value at the same time?**
A: Yes: `const { name: userName = 'Guest' } = user;` — extracts `user.name`, renames it to `userName`, and falls back to `'Guest'` if `user.name` is `undefined`.

## Related Topics
- [spread-operator.md](./spread-operator.md)
- [rest-parameter.md](./rest-parameter.md)
- [default-parameters.md](./default-parameters.md)
- [es2015.md](./es2015.md)
