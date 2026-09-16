# UMD (Universal Module Definition)

UMD is not a distinct module *system* the way CommonJS or AMD are — it's a **defensive coding pattern** for writing a single JavaScript file that works correctly no matter which module system (if any) the consuming environment uses: AMD (browsers with RequireJS), CommonJS (Node.js), or plain global-variable usage (a bare `<script>` tag with no module loader at all). This mattered enormously for library authors in the pre-ES-Modules era, who needed one distributable file that would "just work" whether a consumer was using Node, a RequireJS-based browser app, or simply dropping a `<script>` tag onto a plain HTML page.

The pattern works by wrapping the module's code in an Immediately Invoked Function Expression (IIFE — see [iife.md](./iife.md)) that inspects its environment at runtime: it checks `typeof define === 'function' && define.amd` (AMD present?), then `typeof module === 'object' && module.exports` (CommonJS present?), and falls back to attaching the module directly onto the global object (`window` in browsers) if neither module system is detected. This runtime feature-detection is exactly what makes the single file "universal."

UMD is largely a historical/legacy pattern today: native ES Modules, universally supported by modern browsers and Node.js, provide a standardized module system that doesn't need this kind of environment-detection dance, and modern bundlers can transform a single ESM source into whatever output format (including UMD itself, ironically, for backward-compatible distribution) a project needs. You'll still frequently encounter UMD-wrapped bundles when inspecting the built/distributed output of older or broadly-compatible libraries.

## Examples

```js
// The classic UMD wrapper pattern
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD environment
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS (Node.js) environment
    module.exports = factory();
  } else {
    // No module system — attach to the global object (e.g., window)
    root.myLibrary = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  // The actual module code
  function greet(name) { return `Hello, ${name}!`; }
  return { greet };
}));
```

```js
// Consuming the SAME UMD file in three different environments

// 1. As a global script (no module system)
// <script src="myLibrary.js"></script>
// <script>console.log(myLibrary.greet('Anil'));</script>

// 2. As a CommonJS module (Node.js)
const myLibrary = require('./myLibrary');
console.log(myLibrary.greet('Anil'));

// 3. As an AMD module (RequireJS)
// define(['myLibrary'], function (myLibrary) {
//   console.log(myLibrary.greet('Anil'));
// });
```

## Common Pitfalls / Gotchas

- Assuming UMD is a "real" module system with its own syntax — it's just a defensive IIFE pattern that detects and adapts to whichever module system (or lack thereof) is present at runtime.
- Writing new library code targeting UMD by hand today — modern tooling (Rollup, Webpack, tsup, etc.) can automatically generate a UMD build as one of several output formats from ESM source, so hand-writing the detection boilerplate is rarely necessary anymore.
- Forgetting UMD detection happens at **runtime**, not build time — the same file genuinely contains all three code paths, and the environment check decides which branch actually executes when the file is loaded.
- Confusing UMD with AMD — AMD is one specific asynchronous module format; UMD is a wrapper that can specifically target AMD, CommonJS, or globals all at once, precisely to support environments that might use any of them.

## Interview Questions & Answers

**Q: What problem does the UMD pattern solve, and why was it needed before ES Modules?**
A: It lets a single distributed JavaScript file work correctly across multiple different environments — AMD (RequireJS-based browsers), CommonJS (Node.js), or no module system at all (plain global script) — without needing separate builds for each. This was important for library authors targeting a fragmented pre-ES-Modules ecosystem where consumers might be using any of these systems.

**Q: How does a UMD wrapper decide which module system to use?**
A: At runtime, via feature detection inside an IIFE: it checks for the presence of AMD's `define` function (`typeof define === 'function' && define.amd`), then for CommonJS's `module.exports` (`typeof module === 'object' && module.exports`), and falls back to attaching the module directly onto the global object if neither is found.

**Q: Is UMD still relevant given that ES Modules now exist?**
A: Its underlying problem is largely solved by native ES Modules being universally supported and by modern bundlers being able to generate multiple output formats (including a UMD build) automatically from a single ESM source — so hand-writing UMD wrappers is uncommon for new code today, though you'll still encounter UMD in the distributed output of many existing libraries for backward compatibility.

## Related Topics
- [amd.md](./amd.md)
- [commonjs-module.md](./commonjs-module.md)
- [native-es-module.md](./native-es-module.md)
- [modules.md](./modules.md)
- [iife.md](./iife.md)
