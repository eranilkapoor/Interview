# for await...of

`for await...of` (ES2018) is a loop construct for iterating over **async iterables** — objects that produce a sequence of Promises (or plain values) via an `[Symbol.asyncIterator]` method, rather than the synchronous `[Symbol.iterator]` used by regular `for...of`. On each iteration, `for await...of` automatically `await`s the next value before binding it to the loop variable, meaning it can only be used inside an `async` function (or, in supporting environments, at the top level of a module).

The primary use case is consuming streams of asynchronous data where each item itself takes time to become available — for example, reading chunks from a Node.js readable stream, paginating through pages of an API response one page at a time, or consuming values from an async generator (a generator function declared with `async function*`, which produces a sequence of Promises via `yield`, awaited automatically as they're consumed).

`for await...of` also works transparently with a **synchronous** iterable of Promises (an array of Promises, for instance) — it will `await` each one in turn, sequentially, before moving to the next iteration. This is a meaningful difference from `Promise.all()`: `for await...of` processes the Promises **one at a time, in order** (useful when each step depends on side effects of the previous one, or must not run concurrently), while `Promise.all()` starts and awaits everything concurrently.

## Examples

```js
// Consuming an async generator with for await...of
async function* fetchPagesLazily(totalPages) {
  for (let page = 1; page <= totalPages; page++) {
    await new Promise(res => setTimeout(res, 50)); // simulate network delay
    yield `page-${page}-data`;
  }
}
async function consumePages() {
  for await (const page of fetchPagesLazily(3)) {
    console.log(page); // "page-1-data" "page-2-data" "page-3-data", each after its own delay
  }
}
consumePages();
```

```js
// for await...of on a plain array of Promises — processes them SEQUENTIALLY
async function processSequentially() {
  const promises = [
    new Promise(res => setTimeout(() => res('first'), 300)),
    new Promise(res => setTimeout(() => res('second'), 100)),
  ];
  for await (const result of promises) {
    console.log(result); // "first" THEN "second" — waits for each in array order, not completion order
  }
}
processSequentially();
```

```js
// Contrast: Promise.all() runs them concurrently; for await...of runs them in sequence
async function compareApproaches() {
  const tasks = [() => wait(100, 'a'), () => wait(100, 'b')];

  const concurrentResults = await Promise.all(tasks.map(t => t()));
  console.log(concurrentResults); // both start together — total ~100ms

  for await (const result of tasks.map(t => t())) {
    console.log('sequential:', result); // each awaited one at a time — total ~200ms
  }
}
function wait(ms, val) { return new Promise(res => setTimeout(() => res(val), ms)); }
```

## Common Pitfalls / Gotchas

- Using `for await...of` on an array of Promises expecting them to resolve in the *order they settle* — it actually processes them in **array order**, awaiting each one fully before moving to the next, regardless of which one would settle first.
- Assuming `for await...of` runs iterations concurrently, like `Promise.all()` — it doesn't; each iteration's `await` fully completes before the next iteration even starts, making it inherently sequential.
- Trying to use `for await...of` outside an `async` function (or top-level module context that supports top-level `await`) — this is a `SyntaxError`, since `for await` requires an `async` context to use `await` semantics.
- Forgetting `break`/`return`/`throw` inside a `for await...of` loop over an async generator properly triggers the generator's cleanup (calling its `.return()`), which matters if the generator holds resources (like an open file handle) that need releasing.

## Interview Questions & Answers

**Q: What's the difference between `for...of` and `for await...of`?**
A: `for...of` iterates over a synchronous iterable, pulling values directly. `for await...of` iterates over an async iterable (or a plain iterable of Promises), automatically `await`-ing each value before binding it to the loop variable — and can only be used inside an `async` function (or supported top-level-await contexts).

**Q: If you use `for await...of` on an array of Promises with different resolution times, does it process them in settlement order or array order?**
A: Array order. It awaits each Promise sequentially, in the order they appear in the iterable — even if a later Promise in the array would resolve sooner, the loop still waits for the earlier one to settle first before moving on.

**Q: When would you choose `for await...of` over `Promise.all()` for handling multiple async operations?**
A: When the operations genuinely need to run sequentially — e.g., each step depends on a side effect or result from the previous one, or you specifically want to limit concurrency (like processing paginated API results one page at a time). `Promise.all()` is preferred when the operations are independent and you want them to run concurrently for better performance.

## Related Topics
- [async-await.md](./async-await.md)
- [generators.md](./generators.md)
- [iterators.md](./iterators.md)
- [promises.md](./promises.md)
- [loops-in-javascript.md](./loops-in-javascript.md)
