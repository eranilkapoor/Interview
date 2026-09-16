# WeakSet & WeakMap

`WeakSet` and `WeakMap` are memory-conscious variants of `Set` and `Map` (see [set-map.md](./set-map.md)) that hold their entries **weakly** — meaning a value stored in a `WeakSet`, or a key stored in a `WeakMap`, does **not** prevent that object from being garbage collected if it becomes otherwise unreachable elsewhere in the program. In a regular `Set`/`Map`, any object added is kept alive for as long as the collection itself exists, even if nothing else in the program references it anymore — this can create unintended memory retention if you're using a `Map` purely to attach metadata to objects with independent, unpredictable lifetimes.

Both `WeakSet` and `WeakMap` only accept **objects** (not primitives) as their weakly-held members/keys — `WeakSet` holds only objects as its values, `WeakMap` requires its keys to be objects (though its values can be anything). Because entries can be silently garbage collected at any time, neither type is iterable, has a `.size` property, or supports `.forEach()`/`.clear()` — there's no reliable way to enumerate "everything currently in there" when membership can change due to garbage collection outside your control at unpredictable times.

The classic use case for `WeakMap` is attaching private or auxiliary data to an object without needing to worry about manually cleaning it up when that object is no longer needed elsewhere — e.g., caching computed metadata per DOM node, or (historically, before native `#private` class fields existed) simulating private instance data for a class by keying a module-level `WeakMap` on `this`. `WeakSet` is commonly used to mark/tag a set of objects (e.g., "objects currently being processed, to detect cycles") without keeping them alive artificially.

## Examples

```js
// WeakMap: attaching metadata to objects without preventing garbage collection
const metadata = new WeakMap();

function processElement(el) {
  metadata.set(el, { processedAt: Date.now() }); // attaches data, doesn't keep `el` alive
}

let element = { id: 'temp-node' };
processElement(element);
console.log(metadata.get(element)); // { processedAt: ... }

element = null; // once nothing else references the original object, it (and its
                // WeakMap entry) becomes eligible for garbage collection automatically
```

```js
// WeakMap used to simulate private instance data (a technique pre-dating #private fields)
const privateBalances = new WeakMap();
class BankAccount {
  constructor(initial) { privateBalances.set(this, initial); }
  deposit(amount) { privateBalances.set(this, privateBalances.get(this) + amount); }
  getBalance() { return privateBalances.get(this); }
}
const acc = new BankAccount(100);
acc.deposit(50);
console.log(acc.getBalance()); // 150
console.log(privateBalances.get(acc)); // 150 — but external code has no easy way to reach this map
```

```js
// WeakSet: tagging objects without keeping them alive
const currentlyProcessing = new WeakSet();
function process(obj) {
  if (currentlyProcessing.has(obj)) {
    throw new Error('Circular reference detected!');
  }
  currentlyProcessing.add(obj);
  // ... do processing ...
  currentlyProcessing.delete(obj);
}
```

## Common Pitfalls / Gotchas

- Trying to use a primitive (string, number) as a `WeakMap` key or `WeakSet` value — throws a `TypeError`; both only accept objects, precisely because primitives aren't subject to garbage collection the same way object references are.
- Expecting to iterate over a `WeakMap`/`WeakSet` (`for...of`, `.forEach()`) — neither supports iteration or has a `.size` property, since their contents can change unpredictably due to garbage collection outside your program's control.
- Using `WeakMap`/`WeakSet` where a regular `Map`/`Set` was actually intended — if you genuinely need to enumerate everything currently stored, or need primitive keys/values, `WeakMap`/`WeakSet` are the wrong tool; reach for them specifically when avoiding memory leaks tied to object lifetimes is the actual goal.
- Assuming you can reliably test whether garbage collection has happened for a given entry — there's no API to observe or force this; the whole design intentionally makes GC timing invisible and non-deterministic from the program's perspective.

## Interview Questions & Answers

**Q: What's the key difference between `Map`/`Set` and `WeakMap`/`WeakSet`, and why does it matter for memory management?**
A: `Map`/`Set` hold strong references to their keys/values, keeping them alive (unreachable for garbage collection) for as long as the collection itself exists. `WeakMap`/`WeakSet` hold their object keys/values weakly, meaning those objects can still be garbage collected if nothing else references them, even while "in" the Weak collection — preventing the collection itself from becoming an unintended source of memory leaks for objects with independent lifetimes.

**Q: Why can't `WeakMap` keys (or `WeakSet` values) be primitives?**
A: Because the entire point of "weak" references is tied to garbage collection of objects — primitives aren't garbage collected the same way (they're simple values, not heap-allocated objects with reachability-based lifetimes), so the concept of a "weak reference" to a primitive doesn't meaningfully apply; the spec disallows it, throwing a `TypeError`.

**Q: Give a practical use case for `WeakMap`.**
A: Attaching auxiliary/private data to objects whose lifetime you don't control — e.g., caching computed metadata per DOM element without leaking memory if that element is later removed from the page, or simulating private per-instance data for a class (a technique used before native `#private` class fields existed).

## Related Topics
- [set-map.md](./set-map.md)
- [garbage-collection.md](./garbage-collection.md)
- [stack-overflow-memory-leaks.md](./stack-overflow-memory-leaks.md)
- [private-vs-public.md](./private-vs-public.md)
