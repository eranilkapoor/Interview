# Generators

A generator is a special kind of function — declared with `function*` — that can pause its execution mid-way (at a `yield` expression) and later resume exactly where it left off, preserving all its local state in between. Calling a generator function doesn't run its body immediately; instead, it returns a **generator object**, which conforms to the iterator protocol: calling `.next()` on it resumes execution until the next `yield` (or `return`, or the end of the function), returning an object `{ value, done }` representing the yielded value and whether the generator has finished.

Generators are the underlying mechanism that makes custom iterables easy to write: implementing an object's `[Symbol.iterator]` method as a generator function automatically produces a valid iterator without manually managing `{ next() { ... } }` state machines by hand (see [iterators.md](./iterators.md)). They're also used for lazy sequences (infinite or expensive-to-compute sequences that only produce values as they're actually requested) and, historically, were used as the foundation for early async-flow-control libraries (before native `async`/`await` existed) by pairing generators with Promises to simulate pausable async functions.

`yield` can both produce a value *and* receive a value: the expression `const received = yield someValue;` sends `someValue` out to whoever called `.next()`, and pauses until the *next* `.next(passedInValue)` call, at which point `received` is set to `passedInValue`. Generators also support `yield*` for delegating to another iterable/generator, and `.return()`/`.throw()` methods for externally terminating or injecting an error into a paused generator.

## Examples

```js
// Basic generator: pausing and resuming with yield
function* countTo3() {
  console.log('start');
  yield 1;
  console.log('resumed after first yield');
  yield 2;
  yield 3;
  console.log('finishing');
}
const gen = countTo3(); // nothing runs yet — just creates the generator object
console.log(gen.next()); // "start" logs, then { value: 1, done: false }
console.log(gen.next()); // "resumed..." logs, then { value: 2, done: false }
console.log(gen.next()); // { value: 3, done: false }
console.log(gen.next()); // "finishing" logs, then { value: undefined, done: true }
```

```js
// Generators are iterable — usable directly with for...of and spread
function* fibonacci(limit) {
  let [a, b] = [0, 1];
  while (a < limit) {
    yield a;
    [a, b] = [b, a + b];
  }
}
console.log([...fibonacci(20)]); // [0, 1, 1, 2, 3, 5, 8, 13]
for (const n of fibonacci(10)) {
  console.log(n); // 0 1 1 2 3 5 8
}
```

```js
// yield can receive values passed into subsequent next() calls
function* conversation() {
  const name = yield 'What is your name?';
  const mood = yield `Hello, ${name}! How are you?`;
  return `${name} says they are feeling ${mood}.`;
}
const convo = conversation();
console.log(convo.next().value);         // "What is your name?"
console.log(convo.next('Anil').value);   // "Hello, Anil! How are you?"
console.log(convo.next('great').value);  // "Anil says they are feeling great."
```

## Common Pitfalls / Gotchas

- Assuming calling a generator function runs its body immediately — it doesn't; it only creates the generator object, and no code inside runs until the first `.next()` call.
- Forgetting a generator is a one-time-use iterator — once it's `done`, calling `.next()` again just keeps returning `{ value: undefined, done: true }`; you need a new call to the generator function to start over.
- Confusing the value passed to the *first* `.next()` call — it's discarded, since there's no preceding `yield` expression to receive it; the first `yield`'s value comes from the generator's own code, not from that first `.next()` argument.
- Mixing up `yield` (pause and produce one value, from inside a generator) with `yield*` (delegate to and fully drain another iterable's values, forwarding each one) — they're related but distinct operators.

## Interview Questions & Answers

**Q: What does calling `.next()` on a generator object return?**
A: An object `{ value, done }` — `value` is whatever was passed to the most recently reached `yield` (or the generator's `return` value, or `undefined` if it's already finished), and `done` is `true` once the generator has completed (run past its last `yield`, hit a `return`, or thrown), `false` otherwise.

**Q: How do generators relate to the iterator protocol and `for...of`?**
A: A generator object automatically implements the iterator protocol (`.next()` returning `{value, done}`) as well as being iterable itself (having a `[Symbol.iterator]` method that returns itself). This means generators can be used directly with `for...of`, spread syntax, and destructuring — anywhere an iterable is expected — without any additional boilerplate.

**Q: Can you pass a value back INTO a generator, and how?**
A: Yes — via the argument to `.next(value)`. That `value` becomes the result of the `yield` expression that the generator is currently paused on, letting you send data into a running generator's execution, not just pull data out of it via `yield`.

**Q: How were generators used for asynchronous flow control before `async`/`await` existed?**
A: Libraries combined generators with Promises: a generator would `yield` a Promise, and a driver function would call `.next()` again only once that Promise resolved, feeding the resolved value back in via `.next(value)` — effectively simulating pausable, resumable async functions manually. Native `async`/`await` later standardized this exact pattern directly into the language, making that manual generator-driving machinery unnecessary for most use cases.

## Related Topics
- [iterators.md](./iterators.md)
- [async-await.md](./async-await.md)
- [for-await.md](./for-await.md)
- [closures.md](./closures.md)
