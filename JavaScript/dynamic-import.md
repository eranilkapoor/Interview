# Dynamic Import

Dynamic `import()` (ES2020) is a function-like operator that loads an ES module **at runtime**, as an expression, returning a Promise that resolves to the module's namespace object (containing all its named exports, plus `default` if applicable). Unlike static `import` statements — which must appear at a module's top level, are resolved before any code runs, and are required unconditionally — dynamic `import()` can be called anywhere a normal expression is valid: inside an `if` block, a function, a loop, or in response to an event, making conditional and on-demand module loading possible.

The most common practical use is **code-splitting / lazy loading**: instead of bundling every possible feature into one large JavaScript file loaded up front, an application can defer loading a module until it's actually needed — e.g., loading a heavy charting library only once a user navigates to a page that displays a chart, or loading a modal's implementation only when the user clicks the button that opens it. This reduces initial load time/bundle size significantly for large applications, and virtually every modern framework/bundler (React's `lazy()` + `Suspense`, Vue's async components, Webpack/Vite's automatic code-splitting) builds on top of dynamic `import()` under the hood.

Because dynamic `import()` returns a genuine Promise, it composes naturally with `async`/`await` and standard error handling (`try...catch` around a failed import, e.g., if the network request for the module's file fails) — a meaningful ergonomic advantage over how conditional module loading had to be hacked together in AMD/CommonJS-era code.

## Examples

```js
// Basic dynamic import — loading a module on demand
async function loadMathUtils() {
  const mathUtils = await import('./mathUtils.js');
  console.log(mathUtils.add(2, 3)); // access named exports off the resolved namespace object
}
loadMathUtils();
```

```js
// Conditional loading — impossible with static import syntax
async function loadFeature(featureName) {
  if (featureName === 'charts') {
    const { renderChart } = await import('./charts.js');
    renderChart();
  } else if (featureName === 'export') {
    const { exportToPdf } = await import('./pdfExport.js');
    exportToPdf();
  }
}
loadFeature('charts'); // only downloads/executes charts.js, never pdfExport.js
```

```js
// Lazy-loading on a user interaction, with error handling
button.addEventListener('click', async () => {
  try {
    const { openModal } = await import('./modal.js');
    openModal();
  } catch (err) {
    console.error('Failed to load modal module:', err);
  }
});
// modal.js's code isn't even downloaded until the user actually clicks the button
```

## Common Pitfalls / Gotchas

- Forgetting dynamic `import()` returns a **Promise**, not the module directly — you must `await` it (or use `.then()`) to access its exports; treating the result as synchronous is a common early mistake.
- Overusing dynamic imports for tiny, frequently-needed modules — the overhead of a separate asynchronous load (and potential extra network request) can outweigh the benefit for small, commonly-used code; code-splitting is most valuable for genuinely large or rarely-needed features.
- Not handling the rejection case — a dynamic `import()` can fail (e.g., a network error, or the module file doesn't exist), and an unhandled rejection here behaves like any other unhandled Promise rejection.
- Assuming dynamic `import()` works identically in every environment without any build configuration — while natively supported by modern browsers and Node.js, using it inside older/less-standard bundler setups may require specific configuration to correctly split output into separate chunks.

## Interview Questions & Answers

**Q: What's the key difference between static `import` and dynamic `import()`?**
A: Static `import` is a declarative statement, must appear at a module's top level, and is resolved before any code executes — always unconditional. Dynamic `import()` is an expression (returning a Promise), usable anywhere ordinary code runs, including conditionally or in response to events — enabling on-demand, lazy loading of modules at runtime.

**Q: What's the main practical use case for dynamic imports in a real application?**
A: Code-splitting/lazy loading — deferring the download and execution of a module until it's actually needed (e.g., a heavy feature, a rarely-visited page, or a component only shown after a user interaction), reducing the initial bundle size and load time of the application.

**Q: How would you handle an error if a dynamically imported module fails to load?**
A: Since `import()` returns a Promise, wrap the `await import(...)` call in a standard `try...catch` block (inside an `async` function), or attach a `.catch()` handler if using `.then()` directly — exactly like handling the rejection of any other Promise-returning operation.

## Related Topics
- [native-es-module.md](./native-es-module.md)
- [modules.md](./modules.md)
- [promises.md](./promises.md)
- [async-await.md](./async-await.md)
- [es2020.md](./es2020.md)
