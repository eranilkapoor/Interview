# Web APIs

Web APIs are the set of features provided by the **browser** (not by the JavaScript language/ECMAScript specification itself) that let JavaScript interact with the outside world: the page's structure (`document`/DOM APIs), timers (`setTimeout`, `setInterval`), network requests (`fetch`, `XMLHttpRequest`, `WebSocket`), storage (`localStorage`, `sessionStorage`, `IndexedDB`), and many others (`Geolocation`, `Canvas`, `Notification`, `Web Workers`, `Fetch`, `Intersection Observer`, etc.). This is a critical distinction for interviews: `Array.prototype.map` is part of JavaScript (ECMAScript) and works identically anywhere JS runs, while `document.querySelector` or `fetch` is a Web API — provided by the browser's runtime environment, absent by default in Node.js (which instead offers its own set of host APIs like `fs` and `http`).

Web APIs are precisely what enables JavaScript's asynchronous model in the browser: operations like `setTimeout` and `fetch` are implemented by the browser (often using its own internal multi-threaded infrastructure), running *outside* JavaScript's single main thread. Once the browser finishes the work — the timer elapses, the network response arrives — it queues the associated callback to run back on the main JS thread via the event loop, rather than blocking that thread while waiting (see [event-loop.md](./event-loop.md), [single-threaded-model.md](./single-threaded-model.md)).

Understanding this ECMAScript-vs-Web-API boundary clarifies a lot of confusing JavaScript trivia: why some "JavaScript features" work in Node but not the browser (and vice versa), why the JS spec itself has no concept of I/O or concurrency (it's the host environment's job to provide it), and why the same core language can power such different environments (browsers, servers, embedded devices) simply by pairing the same JS engine with different sets of host-provided APIs.

## Examples

```js
// ECMAScript (language) vs Web API (browser-provided) — both used together
const numbers = [1, 2, 3].map(n => n * 2); // ECMAScript: Array.prototype.map
console.log(numbers); // [2, 4, 6]

// document, fetch, setTimeout are Web APIs — NOT part of the ECMAScript spec
// document.querySelector('#app').textContent = 'Hello'; // DOM Web API (browser only)
// fetch('/api/data').then(res => res.json()); // Fetch Web API (browser; polyfilled in Node)
setTimeout(() => console.log('Timer Web API fired'), 100); // Timers Web API
```

```js
// The same code fails differently depending on host environment
// In a browser:
console.log(typeof document); // "object" — DOM available
// In plain Node.js (no DOM library):
// console.log(typeof document); // "undefined" — Web APIs are browser-specific
console.log(typeof globalThis.fetch !== 'undefined'); // true in modern browsers & modern Node (18+)
```

```js
// Web Workers (a Web API) run JS on a separate thread, communicating via messages
// main.js
// const worker = new Worker('worker.js');
// worker.postMessage({ n: 10 });
// worker.onmessage = (e) => console.log('Worker result:', e.data);
```

## Common Pitfalls / Gotchas

- Assuming everything usable in JavaScript is part of the "JavaScript language" — many everyday APIs (`fetch`, `setTimeout`, `document`, `localStorage`) are Web APIs provided by the browser, not the ECMAScript specification, and won't necessarily exist (or will behave differently) in other JS environments like Node.js.
- Writing code that assumes `document`/`window` exist and running it in Node.js (or a Web Worker, which also lacks `document`) — this throws a `ReferenceError` since those are browser-main-thread-specific globals.
- Believing `setTimeout`/`fetch` are handled "by the JavaScript engine" — they're implemented by the host environment (browser or Node runtime), which is also what actually performs the underlying async work off the main JS thread before handing a callback back to the event loop.
- Confusing Node.js's built-in modules (`fs`, `http`, `path`) with "Web APIs" — they serve an analogous host-API role for a server environment, but they are Node-specific, not part of any Web API standard (though Node has increasingly implemented some Web-API-compatible globals like `fetch` for convenience).

## Interview Questions & Answers

**Q: What's the difference between a JavaScript (ECMAScript) feature and a Web API?**
A: ECMAScript defines the core language — syntax, types, operators, and built-in objects like `Array`, `Object`, `Promise`, `Math` — and works identically in any JS engine, anywhere. Web APIs are features provided by the *browser* specifically (DOM, `fetch`, timers, storage, Web Workers) that JavaScript code can call into, but which aren't part of the language spec itself and aren't necessarily available in non-browser environments like Node.js.

**Q: Why does `setTimeout` not block the main JavaScript thread while waiting?**
A: Because the browser (not the JS engine itself) implements the actual timer/waiting mechanism outside the single JS thread. Once the specified time elapses, the browser queues the callback into the task queue, and the event loop picks it up to run on the main thread only once the thread is free — the waiting itself never occupies the JS thread.

**Q: If Node.js doesn't have a DOM, how does it provide similar capabilities to browser Web APIs?**
A: Node.js provides its own set of host APIs suited to a server environment — `fs` for file system access, `http`/`https` for networking, `path`, `process`, etc. — conceptually analogous to how browsers provide DOM/`fetch`/storage, but tailored to a non-browser context. Some Web-API-compatible globals (like `fetch`, `URL`, and `AbortController`) have also been added directly to modern Node.js for interoperability.

## Related Topics
- [javascript-runtime.md](./javascript-runtime.md)
- [event-loop.md](./event-loop.md)
- [nodejs-runtime.md](./nodejs-runtime.md)
- [web-worker.md](./web-worker.md)
- [asynchronus-javascript.md](./asynchronus-javascript.md)
