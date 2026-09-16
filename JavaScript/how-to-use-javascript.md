# How to Use JavaScript

JavaScript can be included in a web page in three ways: inline (directly inside an HTML attribute like `onclick="..."`), internal (inside a `<script>` tag in the HTML document), and external (a separate `.js` file referenced via `<script src="...">`). External scripts are the standard for any non-trivial project because they enable browser caching, separation of concerns, and reuse across multiple pages.

Where you place the `<script>` tag — and which attributes you use — materially affects page performance and behavior. A plain `<script src="app.js">` in the `<head>` blocks HTML parsing until the script downloads and executes. The `defer` attribute downloads the script in parallel with parsing but executes it only after the DOM is fully parsed (and in document order relative to other deferred scripts) — ideal for scripts that manipulate the DOM. The `async` attribute downloads in parallel and executes as soon as it's ready, potentially before the DOM is fully parsed and out of order relative to other scripts — best for independent scripts like analytics.

Outside the browser, JavaScript is "used" by running it through a runtime like Node.js (`node app.js`), Deno, or Bun, or by bundling/transpiling it (via Webpack, Vite, esbuild, Babel) into a form compatible with target environments before shipping it. Modern development almost always involves a build step: transpiling newer syntax to older syntax for compatibility, bundling multiple modules into fewer files, minifying for size, and tree-shaking to remove unused code.

## Examples

```html
<!-- Blocking script in <head>: parsing pauses until this loads & runs -->
<script src="app.js"></script>
```

```html
<!-- defer: downloads in parallel, executes after HTML parsing, in order -->
<script src="app.js" defer></script>
```

```html
<!-- async: downloads in parallel, executes immediately when ready (order not guaranteed) -->
<script src="analytics.js" async></script>
```

```js
// Running JavaScript outside the browser via Node.js
// file: hello.js
console.log('Hello from Node.js');
// Run with: node hello.js
```

## Common Pitfalls / Gotchas

- Placing a large blocking `<script>` in `<head>` without `defer`/`async`, delaying first paint of the page.
- Assuming `async` scripts execute in the order they appear in the HTML — they don't; only `defer` scripts preserve document order.
- Forgetting that inline event handlers (`onclick="..."`) run in the global scope and mix markup with logic, making code harder to maintain — modern practice prefers `addEventListener` in a separate script.
- Not accounting for browser support when using newer syntax without a transpiler/bundler — code that works in your dev browser may throw a `SyntaxError` in an older one.

## Interview Questions & Answers

**Q: What's the difference between `async` and `defer` on a `<script>` tag?**
A: Both download the script without blocking HTML parsing. `defer` scripts execute only after parsing completes, in the order they appear. `async` scripts execute as soon as they finish downloading, which can be before parsing completes and in a different order than they appear — so `async` is best for independent scripts with no DOM dependencies.

**Q: Why do modern projects need a build step for JavaScript?**
A: To transpile modern syntax to widely-supported syntax (Babel), bundle many modules into fewer network requests (Webpack/Vite/esbuild), minify code to reduce size, and tree-shake unused exports — none of which browsers do natively for arbitrary source code.

**Q: How do you run JavaScript outside a browser?**
A: Via a standalone runtime such as Node.js, Deno, or Bun, which embeds a JS engine (V8 for Node/Bun via V8, or V8/other for Deno) along with host APIs (file system, networking) that replace the DOM/browser APIs.

## Related Topics
- [javascript-runtime.md](./javascript-runtime.md)
- [nodejs-runtime.md](./nodejs-runtime.md)
- [modules.md](./modules.md)
- [compiler.md](./compiler.md)
