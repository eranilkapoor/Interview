# Iterators

An iterator is any object that implements the **iterator protocol**: it has a `.next()` method that, each time it's called, returns an object of the shape `{ value, done }` — `value` being the next item in the sequence, and `done` being a boolean indicating whether the sequence has been exhausted. This simple, uniform contract is what lets JavaScript provide generic mechanisms — `for...of`, the spread operator (`...`), destructuring, `Array.from()` — that work identically across very different data structures (arrays, strings, `Map`, `Set`, `NodeList`, and any custom object that implements the protocol) without needing type-specific logic for each one.

Closely related is the **iterable protocol**: an object is iterable if it has a method at the special key `[Symbol.iterator]` that returns an iterator. Built-in iterables (arrays, strings, Maps, Sets) already implement this; you can make any custom object iterable by defining its own `[Symbol.iterator]` method, either manually (returning a hand-written `{ next() {...} }` object) or, much more conveniently, using a generator function (see [generators.md](./generators.md)), since generator objects automatically satisfy both the iterator *and* iterable protocols at once.

This distinction — "iterable" (has `[Symbol.iterator]`, describing *how to get* an iterator) vs "iterator" (has `.next()`, *is* the thing that actually produces values one at a time) — is a frequent, precise interview question, because many candidates conflate the two even though they're formally distinct (though closely related and often implemented together).

## Examples

```js
// A plain array's default iterator, used manually
const arr = ['a', 'b', 'c'];
const iterator = arr[Symbol.iterator]();
console.log(iterator.next()); // { value: 'a', done: false }
console.log(iterator.next()); // { value: 'b', done: false }
console.log(iterator.next()); // { value: 'c', done: false }
console.log(iterator.next()); // { value: undefined, done: true }
```

```js
// A custom iterable object, implemented WITHOUT a generator
function range(start, end) {
  return {
    [Symbol.iterator]() {
      let current = start;
      return {
        next() {
          if (current <= end) {
            return { value: current++, done: false };
          }
          return { value: undefined, done: true };
        }
      };
    }
  };
}
console.log([...range(1, 5)]); // [1, 2, 3, 4, 5]
for (const n of range(1, 3)) console.log(n); // 1 2 3
```

```js
// The same custom iterable, MUCH more concisely, using a generator
function* rangeGen(start, end) {
  for (let i = start; i <= end; i++) yield i;
}
console.log([...rangeGen(1, 5)]); // [1, 2, 3, 4, 5]
// A generator function automatically satisfies BOTH the iterable and iterator protocols
```

## Common Pitfalls / Gotchas

- Conflating "iterable" and "iterator" — an iterable is something you can *get* an iterator from (via `[Symbol.iterator]`); an iterator is the object that actually produces values via `.next()`. They're related but not the same thing.
- Assuming plain objects (`{}`) are iterable by default — they're not; only arrays, strings, Maps, Sets, and other objects that explicitly implement `[Symbol.iterator]` work with `for...of`/spread. Iterating a plain object's *properties* requires `for...in`, `Object.keys()`, or `Object.entries()` instead.
- Writing a custom iterator by hand and forgetting to eventually return `{ done: true }` — an iterator that always reports `done: false` will cause `for...of`/spread to loop forever.
- Believing calling `.next()` multiple times on the *same* iterator restarts the sequence — it doesn't; iterators are stateful and exhausted once `done` becomes `true`; you need a fresh iterator (or iterable) to start over.

## Interview Questions & Answers

**Q: What's the difference between the iterable protocol and the iterator protocol?**
A: The iterable protocol requires an object to have a `[Symbol.iterator]` method that returns an iterator. The iterator protocol requires that returned object to have a `.next()` method returning `{ value, done }`. An object can satisfy both simultaneously (as generator objects do, by returning themselves from `[Symbol.iterator]`), but conceptually they describe different responsibilities.

**Q: How would you make a custom object work with `for...of`?**
A: Implement a `[Symbol.iterator]` method on it that returns an object with a `.next()` method following the iterator protocol (`{ value, done }`) — either handwritten as a stateful closure, or far more simply, by making `[Symbol.iterator]` a generator function, since generators automatically produce a conforming iterator.

**Q: Are plain JavaScript objects (`{}`) iterable? How would you loop over their properties instead?**
A: No, plain objects don't implement `[Symbol.iterator]` by default, so `for...of` and spread don't work directly on them. To iterate their properties, use `for...in` (keys, including inherited ones), or `Object.keys()`/`Object.values()`/`Object.entries()` combined with `for...of` or array methods.

## Related Topics
- [generators.md](./generators.md)
- [loops-in-javascript.md](./loops-in-javascript.md)
- [spread-operator.md](./spread-operator.md)
- [set-map.md](./set-map.md)
