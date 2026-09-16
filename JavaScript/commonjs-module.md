# CommonJS Modules

CommonJS is the module system Node.js used from its very beginning — files export values via `module.exports` (or the shorthand `exports.name = value`) and import other modules via `require('./path')`. It predates JavaScript having any native, language-level module syntax, and it was specifically designed for a synchronous, server-side, filesystem-backed environment — an assumption that works fine in Node (files are already local, so loading them synchronously is cheap) but would be problematic in a browser (synchronously blocking on a network request for every `require()` would be terrible for performance), which is exactly why CommonJS was never natively adopted by browsers.

`require()` is a genuine function call, evaluated at runtime, not special syntax processed at parse time — you can call it conditionally, inside an `if` block, or with a dynamically computed path, none of which are possible with static ES Module `import` statements. Node caches modules by their resolved absolute file path: the *first* `require()` of a given file actually executes that file's top-level code and caches the resulting `module.exports` object; every subsequent `require()` of that same file (from anywhere in the program) returns the *same cached object* without re-running the file.

Each CommonJS module receives its own private scope automatically — Node wraps every file's contents in an implicit function wrapper behind the scenes, giving each module its own local `module`, `exports`, `require`, `__filename`, and `__dirname` — so top-level `var`/`let`/`const` declarations in one file are never visible to another file without an explicit `require()`/export.

## Examples

```js
// mathUtils.js — exporting via module.exports
function add(a, b) { return a + b; }
function subtract(a, b) { return a - b; }
module.exports = { add, subtract };
// Equivalent shorthand: exports.add = add; exports.subtract = subtract;
```

```js
// app.js — importing via require()
const { add, subtract } = require('./mathUtils');
console.log(add(5, 3), subtract(5, 3)); // 8 2
```

```js
// require() is a real function call — can be used conditionally, unlike static import
function loadLogger(useVerbose) {
  const logger = useVerbose ? require('./verboseLogger') : require('./simpleLogger');
  return logger;
}

// Module caching: the file's top-level code runs only ONCE, ever, per process
// counter.js
console.log('counter.js is executing'); // only logs the FIRST time this file is required
module.exports = { count: 0 };

// app.js
const c1 = require('./counter'); // logs "counter.js is executing"
const c2 = require('./counter'); // does NOT log again — returns the cached module.exports
console.log(c1 === c2); // true — same cached object
```

## Common Pitfalls / Gotchas

- Assuming `require()`-ing the same file twice re-runs its code — it doesn't; Node caches modules by resolved path, so the file's top-level code executes only once per process, and subsequent `require()` calls return the cached `exports` object.
- Reassigning `exports` directly (`exports = { ... }`) instead of `module.exports` — this breaks the export, because `exports` is just a local variable initially pointing to the same object as `module.exports`; reassigning `exports` itself only changes that local variable, not what `module.exports` (the thing actually returned by `require()`) points to.
- Using CommonJS `require()` syntax in a browser without a bundler — browsers have no native `require()`; tools like Webpack/Browserify historically provided a `require()`-compatible shim specifically to make CommonJS code work in the browser.
- Forgetting that circular `require()`s (module A requires B, which requires A) can return a partially-populated `module.exports` object, since CommonJS resolves circular dependencies by returning whatever has been exported *so far* at the point of the circular reference, not the final complete version.

## Interview Questions & Answers

**Q: Why was CommonJS designed to be synchronous, and why doesn't that design work well for browsers?**
A: CommonJS (and Node.js generally) was designed around synchronous local filesystem access, where blocking briefly to read a file is cheap and acceptable. In a browser, modules would typically need to be fetched over the network, and blocking synchronously on a network request for every `require()` call would badly hurt page load performance — which is why browsers never natively adopted CommonJS, and why AMD (asynchronous by design) emerged specifically to fill that browser-side gap before ES Modules existed.

**Q: How does Node.js's module caching behavior work?**
A: Node resolves each `require()` call to an absolute file path and caches the resulting `module.exports` object keyed by that path. The very first `require()` of a given file actually executes its top-level code; every later `require()` of the same file (from anywhere in the program) returns the identical cached object without re-executing the file.

**Q: Why does reassigning `exports` directly (instead of `module.exports`) fail to actually change what a `require()` call receives?**
A: `exports` starts out as just a convenience variable pointing to the same object as `module.exports`. What `require()` actually returns is whatever `module.exports` points to at the end of the file's execution. Reassigning the local `exports` variable to a new object only redirects that local variable — it doesn't update `module.exports`, so the caller of `require()` still gets the original, unmodified object.

## Related Topics
- [modules.md](./modules.md)
- [native-es-module.md](./native-es-module.md)
- [nodejs-runtime.md](./nodejs-runtime.md)
- [amd.md](./amd.md)
