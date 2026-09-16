# Function Invocation

Function invocation is the act of actually executing a function — calling it, as opposed to merely defining it. How a function is invoked determines the value of `this` inside it (for regular functions), which is one of the most heavily tested JavaScript interview concepts. JavaScript has four classic invocation patterns, each binding `this` differently: **function invocation** (`fn()` — `this` is `undefined` in strict mode, or the global object in non-strict mode), **method invocation** (`obj.fn()` — `this` is `obj`), **constructor invocation** (`new Fn()` — `this` is the newly created object), and **explicit invocation** via `.call()`/`.apply()`/`.bind()` (`this` is whatever you explicitly pass in).

Every regular (non-arrow) function automatically receives two implicit values when invoked: `this` (per the rules above) and `arguments` (an array-like object of all passed arguments, regardless of the declared parameter list). Arrow functions receive neither — they inherit both lexically from their enclosing scope instead, which is precisely why arrow functions behave differently across these invocation patterns (see [arrow-function.md](./arrow-function.md)).

Understanding invocation patterns explains a huge share of "`this` is undefined/wrong" bugs: extracting a method off an object and calling it elsewhere (`const fn = obj.method; fn();`) switches from method invocation to plain function invocation, silently losing the intended `this` binding — a classic gotcha when passing object methods as callbacks (e.g., to `setTimeout` or as an event handler) without `.bind()`.

## Examples

```js
// Function invocation vs method invocation — same function, different `this`
function whoAmI() {
  console.log(this);
}
whoAmI(); // `this` is undefined (strict mode) or globalThis (non-strict)

const obj = { whoAmI };
obj.whoAmI(); // `this` is `obj` — method invocation

const extracted = obj.whoAmI;
extracted(); // `this` reverts to undefined/global — the binding was lost!
```

```js
// Constructor invocation via `new`
function Person(name) {
  this.name = name; // `this` is the newly created object
}
const p = new Person('Anil');
console.log(p.name); // "Anil"
console.log(p instanceof Person); // true
```

```js
// Explicit invocation with call/apply/bind overrides `this` directly
function greet() { console.log(`Hello, ${this.name}`); }
const context = { name: 'Sunita' };
greet.call(context);  // "Hello, Sunita"
greet.apply(context); // "Hello, Sunita"
const bound = greet.bind(context);
bound();               // "Hello, Sunita"
```

## Common Pitfalls / Gotchas

- Extracting a method from an object and passing it as a callback (`setTimeout(obj.method, 1000)`) without binding — `this` reverts to `undefined`/global inside the callback, breaking any internal reference to the original object.
- Forgetting constructor invocation requires `new` — calling a constructor function without `new` runs it as a plain function invocation, so `this` won't be a new object (in strict mode, assigning to `this.x` inside will throw, since `this` is `undefined`).
- Assuming arrow functions follow these same four invocation rules — they don't; they ignore call-site `this` entirely and always use the lexical `this` from where they were defined.
- Believing `arguments` reflects only the declared parameters — it contains *all* arguments actually passed, regardless of how many parameters the function declares.

## Interview Questions & Answers

**Q: What are the four ways a regular function can be invoked, and how does each affect `this`?**
A: (1) Plain function invocation (`fn()`) — `this` is `undefined` in strict mode or the global object otherwise. (2) Method invocation (`obj.fn()`) — `this` is `obj`. (3) Constructor invocation (`new Fn()`) — `this` is a newly created object linked to `Fn.prototype`. (4) Explicit invocation (`fn.call(ctx)`, `fn.apply(ctx)`, `fn.bind(ctx)()`) — `this` is whatever context you explicitly supply.

**Q: Why does extracting a method and calling it separately often break code that relies on `this`?**
A: Because `this` is determined by the *call site*, not by where the function was originally defined or attached. `const fn = obj.method; fn();` invokes `fn` as a plain function call, not a method call on `obj`, so `this` no longer refers to `obj` inside it. Fixing it requires `.bind(obj)`, an arrow-function wrapper, or calling it as `obj.method()` directly.

**Q: What happens to `this` if you call a regular function that assumes `this` is an object, but forget the `new` keyword on a constructor function?**
A: Without `new`, the function runs as a plain function invocation — `this` is `undefined` (strict mode) or the global object (non-strict). Assigning `this.someProp = value` then either throws a `TypeError` (strict mode, `this` is `undefined`) or silently creates/overwrites a global variable (non-strict mode) — neither of which produces the intended new object.

## Related Topics
- [this-keyword.md](./this-keyword.md)
- [new-keyword.md](./new-keyword.md)
- [call-function.md](./call-function.md)
- [apply-function.md](./apply-function.md)
- [bind-function.md](./bind-function.md)
