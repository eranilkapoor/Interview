# AMD (Asynchronous Module Definition)

AMD is a module format designed specifically for **browsers**, at a time (pre-ES2015) when JavaScript had no native module system and CommonJS's synchronous `require()` was unsuitable for a network-backed environment (blocking on every module load over HTTP would be far too slow). AMD modules are defined with a `define(id?, dependencies, factory)` call: an optional module ID, an array of dependency module names to load, and a factory function that receives those dependencies as arguments once they've all finished loading **asynchronously** — hence the name.

The most well-known AMD implementation was **RequireJS**, a browser-based module loader that would read `define()` calls, fetch each listed dependency via a separate `<script>` request, and only invoke the factory function once every dependency had loaded, resolving what would otherwise be an awkward, manually-managed web of `<script>` tag ordering and global-variable dependencies. `require(dependencies, callback)` (a sibling function to `define`) was used for loading modules from top-level application code, similarly asynchronously.

AMD is now largely legacy: native ES Modules (which also support asynchronous loading, natively, without needing a separate loader library) have made AMD unnecessary for new projects, and modern bundlers (Webpack, Vite, esbuild, Rollup) handle dependency resolution and bundling at build time instead. AMD is still worth recognizing for reading older codebases/libraries and for understanding the broader historical arc of JavaScript's module systems (see [modules.md](./modules.md)).

## Examples

```js
// Defining an AMD module with a dependency
// mathUtils.js
define(['./logger'], function (logger) {
  function add(a, b) {
    logger.log(`Adding ${a} and ${b}`);
    return a + b;
  }
  return { add }; // the factory's return value becomes this module's exported value
});
```

```js
// A dependency-free AMD module
// logger.js
define([], function () {
  return {
    log(message) { console.log(`[LOG]: ${message}`); }
  };
});
```

```js
// Using require() (AMD-style) to load modules from top-level application code
require(['./mathUtils'], function (mathUtils) {
  console.log(mathUtils.add(2, 3)); // logs via logger, then "5"
});
// This require() call is asynchronous — it doesn't block; the callback runs once
// mathUtils.js (and its own dependency, logger.js) have both finished loading.
```

## Common Pitfalls / Gotchas

- Confusing AMD's `require()` (asynchronous, callback-based, browser-oriented) with CommonJS's `require()` (synchronous, return-value-based, Node-oriented) — they share a name but behave completely differently.
- Assuming AMD is still a relevant choice for new projects — it's essentially legacy technology today; native ES Modules and modern bundlers have fully superseded its use case.
- Forgetting AMD modules must declare all their dependencies up front in the `dependencies` array — unlike CommonJS's ability to `require()` conditionally at any point in the code, AMD's dependency list is fixed and loaded entirely before the factory function runs.
- Mixing up AMD with UMD — AMD is one specific module format; UMD is a wrapper pattern designed to support AMD, CommonJS, *and* global-script usage simultaneously in one file.

## Interview Questions & Answers

**Q: Why was AMD designed around asynchronous loading, unlike CommonJS?**
A: Because AMD targeted browsers, where modules typically need to be fetched over the network via HTTP requests. Blocking synchronously on every module load (as CommonJS's `require()` does, which is fine for a local filesystem) would badly hurt page performance in a browser, so AMD's `define()`/`require()` load dependencies asynchronously and only invoke the factory function once all listed dependencies have finished loading.

**Q: What library popularized AMD, and what problem did it solve for browser-based JavaScript before ES Modules existed?**
A: RequireJS. It solved the problem of manually managing `<script>` tag load order and global-variable-based dependencies between files — instead, each module explicitly declared its dependencies via `define()`, and RequireJS handled fetching and sequencing the asynchronous loading automatically, invoking each module's factory only once its dependencies were ready.

**Q: Is AMD still commonly used in new JavaScript projects today?**
A: No — it's essentially legacy. Native ES Modules (natively supported by all modern browsers, with built-in asynchronous loading support) combined with modern build tools (Webpack, Vite, Rollup, esbuild) have made AMD unnecessary for new development; it mainly persists in older libraries and legacy codebases.

## Related Topics
- [modules.md](./modules.md)
- [umd.md](./umd.md)
- [commonjs-module.md](./commonjs-module.md)
- [native-es-module.md](./native-es-module.md)
