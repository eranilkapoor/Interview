# Events

`EventEmitter`, from the `node:events` module, is the foundational pattern underlying almost all asynchronous, event-driven APIs in Node core — `http.Server`, `net.Socket`, streams, `process`, and countless third-party libraries all extend or use `EventEmitter` internally. It implements the observer pattern: an object maintains named lists of listener functions, `.emit(eventName, ...args)` synchronously invokes every listener registered for that event name (in registration order) with the given arguments, and `.on(eventName, listener)` registers a listener. It's the mechanism that lets Node model "things that happen over time" (a connection arriving, a chunk of data being ready, a process signal) as a subscribable API rather than forcing everything through callbacks or promises.

The core API surface is small: `.on(event, listener)` (alias `.addListener`) subscribes a listener that fires every time the event is emitted; `.once(event, listener)` subscribes a listener that automatically removes itself after firing exactly once — useful for "wait for this to happen one time" scenarios like a `'connect'` event; `.emit(event, ...args)` triggers all listeners for that event synchronously, in order, and returns `true` if there were any listeners, `false` otherwise; `.removeListener(event, listener)` (alias `.off`) unsubscribes a specific listener, requiring you to have kept a reference to the original function; `.removeAllListeners([event])` strips all listeners for an event (or all events if omitted).

The `'error'` event gets special-cased behavior that trips up many developers: if an `EventEmitter` emits `'error'` and there is no listener registered for it, Node throws the error and — for the default global uncaught exception behavior — crashes the process. This is a deliberate design decision forcing you to explicitly handle error conditions on emitters (streams, sockets, etc.) rather than silently swallowing them, since an emitted event with no listener otherwise does nothing and fails silently. Any code that creates or consumes an `EventEmitter`-based API (like an `http.Server`, a `net.Socket`, or a custom emitter) needs an `'error'` listener if there's any chance of it emitting one, or the whole process goes down.

`EventEmitter` also enforces a max-listener warning: by default, if more than 10 listeners are registered for the same event on the same emitter, Node prints a `MaxListenersExceededWarning` to stderr. This isn't a hard limit — it's a leak-detection heuristic, since accidentally adding a listener inside a function that gets called repeatedly (e.g., inside a request handler, once per request) is a very common way to leak memory and listeners over time. You can adjust it per-instance with `.setMaxListeners(n)` or globally via `EventEmitter.defaultMaxListeners`, but the more correct fix is usually finding and removing the leak rather than raising the threshold.

## Examples

```js
// A custom EventEmitter-based API, mirroring how Node core objects work
const { EventEmitter } = require('node:events');

class OrderProcessor extends EventEmitter {
  process(order) {
    this.emit('started', order.id);
    try {
      if (!order.total || order.total <= 0) {
        throw new Error('invalid order total');
      }
      this.emit('completed', order.id, order.total);
    } catch (err) {
      this.emit('error', err); // must have a listener or the process crashes
    }
  }
}

const processor = new OrderProcessor();
processor.on('started', (id) => console.log(`order ${id} started`));
processor.on('completed', (id, total) => console.log(`order ${id} completed: $${total}`));
processor.on('error', (err) => console.error('order failed:', err.message));

processor.process({ id: 1, total: 50 });
processor.process({ id: 2, total: 0 }); // triggers the error path
```

```js
// once() for a one-time event, and removeListener for manual cleanup
const { EventEmitter } = require('node:events');
const emitter = new EventEmitter();

function onReady() {
  console.log('service is ready (fires only once)');
}
emitter.once('ready', onReady);

function logAll(msg) {
  console.log('log:', msg);
}
emitter.on('log', logAll);

emitter.emit('ready'); // "service is ready..."
emitter.emit('ready'); // nothing -- listener already removed after first fire

emitter.emit('log', 'first');
emitter.removeListener('log', logAll); // must pass the same function reference
emitter.emit('log', 'second'); // nothing -- listener was removed
```

```js
// The MaxListenersExceededWarning, and why it usually indicates a leak
const { EventEmitter } = require('node:events');
const emitter = new EventEmitter();
emitter.setMaxListeners(5); // lower for demonstration (default is 10)

function subscribeOnEveryCall() {
  emitter.on('tick', () => {}); // BUG: adds a new listener every call instead of once
}

for (let i = 0; i < 6; i++) {
  subscribeOnEveryCall();
}
// Prints: MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
// 6 tick listeners added to [EventEmitter]. Use emitter.setMaxListeners() to
// increase limit -- but the real fix is to subscribe once, outside the loop.
console.log(emitter.listenerCount('tick')); // 6
```

## Common Pitfalls / Gotchas

- Emitting `'error'` on an `EventEmitter` with no `'error'` listener attached — Node treats this as an uncaught exception and crashes the process by default; always attach an `'error'` handler on any emitter that might emit one (streams, sockets, custom emitters).
- Registering a new listener inside a function that runs repeatedly (e.g., per request, per loop iteration) instead of once at setup — a classic memory/listener leak that eventually triggers `MaxListenersExceededWarning` or silently degrades performance.
- Calling `.removeListener()` with an anonymous inline function — since you need the exact same function reference to remove it, `emitter.on('x', () => {})` can never be individually removed later; keep a named reference if you'll need to unsubscribe.
- Raising `setMaxListeners()` to silence the warning instead of fixing the underlying leak — the warning is a diagnostic signal, not an arbitrary limit to work around.
- Assuming `.emit()` is asynchronous — it calls all listeners synchronously, in registration order, on the current call stack; if a listener throws, it can interrupt the emit call before later listeners run (unless caught).
- Forgetting that `.once()` listeners still count toward `listenerCount`/max-listeners until they actually fire once and get auto-removed.
- Not checking `.emit()`'s boolean return value when you need to know whether anyone was listening (it returns `false` if there were no listeners for that event name).

## Interview Questions & Answers

**Q: What happens if you emit an `'error'` event on an EventEmitter with no error listener attached?**
A: Node treats it as an uncaught exception on the process and, by default, crashes the process (after printing the error). This is intentional — it forces you to explicitly opt in to handling errors on any given emitter rather than letting them fail silently, since an emitted event with zero listeners otherwise just does nothing.

**Q: What's the difference between `.on()` and `.once()`?**
A: `.on()` (aka `.addListener()`) registers a listener that fires every time the named event is emitted, indefinitely, until explicitly removed. `.once()` registers a listener that automatically removes itself immediately after it fires for the first time, so it only ever runs once regardless of how many more times the event is emitted afterward.

**Q: Why does Node warn about "possible EventEmitter memory leak" after 10 listeners on one event?**
A: It's a heuristic to catch a common bug: code that subscribes a new listener every time some function runs (e.g., inside a request handler or loop) instead of subscribing once. Each unremoved listener also keeps its closure's referenced variables alive, so this pattern is a real memory leak over time, not just a listener-count issue. The warning threshold is adjustable via `setMaxListeners()`, but that should be a deliberate choice for a legitimately high-fanout emitter, not a fix for an actual leak.

**Q: Is `EventEmitter.emit()` synchronous or asynchronous?**
A: Synchronous. Calling `.emit()` invokes every registered listener for that event, in registration order, on the current call stack before `.emit()` returns. If you need listeners to run asynchronously, you have to explicitly defer them (e.g., with `setImmediate` or `queueMicrotask` inside the listener, or by emitting from within an already-async context).

**Q: How would you properly remove a specific listener you added earlier?**
A: Keep a reference to the actual function passed to `.on()`/`.once()` (not an inline anonymous arrow function you can't reference again), and call `emitter.removeListener(eventName, thatSameFunctionReference)` (or the `.off()` alias). Passing a different function, even one with identical code, will not remove the original listener.

## Related Topics

- [streams.md](./streams.md)
- [http.md](./http.md)
- [process-and-os.md](./process-and-os.md)
- [error-handlings.md](./error-handlings.md)
- [event-loop.md](./event-loop.md)
