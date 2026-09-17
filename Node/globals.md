# Globals

Node.js exposes a set of globals available to every module without requiring an explicit `require`/`import` — some are true globals shared across the whole process (`process`, `console`, `Buffer`, the `setTimeout`/`setInterval`/`setImmediate` timer functions, `globalThis`), while others (`__dirname`, `__filename`, `module`, `exports`, `require`) are technically **module-scoped**, not truly global — they look global because Node wraps every CommonJS file in an implicit function that injects them as local parameters, but they differ per file rather than being shared singletons.

`process` is the most important global for real applications — it's an `EventEmitter` representing the current Node process, exposing `process.env` (environment variables), `process.argv` (CLI arguments), `process.exit(code)`, `process.cwd()`, `process.platform`, `process.version`, `process.on('uncaughtException'/'unhandledRejection'/'SIGTERM', ...)` for process-level event handling, and `process.nextTick()`. `console` provides the familiar `.log`/`.error`/`.warn`/`.table`/`.time` logging API, writing to `stdout`/`stderr`. `Buffer` (covered in depth in [buffers.md](./buffers.md)) is globally available without an import for historical reasons, unlike most other Node APIs which live under `node:` modules. `globalThis` is the standard ECMAScript way to reference the global object portably across JS environments (browser `window`, Node `global`, workers) — in Node, `global` and `globalThis` refer to the same object, but `globalThis` is the modern, environment-agnostic spelling.

`__dirname` and `__filename` are CommonJS-only module-scoped values giving the absolute directory path and absolute file path of the *current module file* respectively — extremely common for building file paths relative to the current file (`path.join(__dirname, 'data.json')`) reliably regardless of the working directory the process was launched from. Critically, these do **not exist in ES modules** (`.mjs` files, or `.js` with `"type": "module"` in package.json) — attempting to reference them throws a ReferenceError. The ESM equivalent is `import.meta.url`, which gives a `file://` URL for the current module; converting it to a usable path requires `fileURLToPath(import.meta.url)` from `node:url`, and the directory equivalent is typically derived with `path.dirname(fileURLToPath(import.meta.url))`. This ESM/CommonJS discrepancy is one of the most common practical gotchas when migrating a codebase or mixing module systems.

`module`, `exports`, and `require` are likewise CommonJS module-scoped constructs, not true process-wide globals — each file gets its own `module` object (with `module.exports` as the actual object returned by `require()`), its own `exports` shorthand reference (initially pointing to the same object as `module.exports`, but reassigning `exports = {...}` breaks that link since it just repoints the local variable, not `module.exports`), and its own `require` function scoped to resolve relative paths from that file's location. ES modules use `import`/`export` syntax instead and have no `module`/`exports`/`require` at all (though `require` can be reconstructed in ESM via `createRequire` from `node:module` when interop with a CommonJS-only package is unavoidable).

## Examples

```js
// process: environment, args, and graceful shutdown handling
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('CLI args:', process.argv.slice(2));
console.log('PORT env var:', process.env.PORT || '3000 (default)');

process.on('SIGTERM', () => {
  console.log('received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('uncaught exception, exiting:', err);
  process.exit(1);
});
```

```js
// __dirname/__filename in CommonJS vs import.meta.url in ESM

// --- CommonJS (file.js, no "type": "module") ---
const path = require('node:path');
console.log(__dirname);              // e.g. /home/user/project/src
console.log(__filename);             // e.g. /home/user/project/src/file.js
const configPath = path.join(__dirname, 'config.json');

// --- ES Module (file.mjs, or .js with "type": "module" in package.json) ---
// __dirname and __filename would throw ReferenceError here -- use this instead:
import { fileURLToPath } from 'node:url';
import path2 from 'node:path';

const __filenameESM = fileURLToPath(import.meta.url);
const __dirnameESM = path2.dirname(__filenameESM);
console.log(__dirnameESM);
```

```js
// module.exports vs exports, and the reassignment pitfall
// file: math.js
exports.add = (a, b) => a + b;      // works: mutates the object module.exports points to
module.exports.subtract = (a, b) => a - b; // also fine, same underlying object

// This BREAKS the link -- exports now points to a NEW object,
// but require() still returns the ORIGINAL module.exports:
// exports = { multiply: (a, b) => a * b };  // 'multiply' would NOT be visible externally

// Correct way to fully replace the export shape:
module.exports = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b,
};
```

## Common Pitfalls / Gotchas

- Using `__dirname`/`__filename` in an ES module — they don't exist there and throw a `ReferenceError`; use `fileURLToPath(import.meta.url)` and `path.dirname()` instead.
- Reassigning `exports = {...}` expecting it to change what `require()` returns — it only repoints the local `exports` variable, breaking its link to `module.exports`; only assigning to `module.exports` directly (or mutating the existing `exports` object's properties) actually changes what callers receive.
- Assuming `Buffer` needs a `require('node:buffer')` — it's one of the few APIs available as a true global without import, though `require('node:buffer')` still works and is needed for some less common exports like `Blob`/`File` in older Node versions.
- Treating `process.env` values as anything but strings — all environment variables are strings, so `process.env.PORT` is `"3000"`, not the number `3000`; comparisons/arithmetic need explicit conversion.
- Not handling `process.on('unhandledRejection', ...)` — in modern Node, unhandled promise rejections terminate the process by default, which is often desired but should be handled deliberately rather than discovered in production.
- Confusing `global` (Node-specific) with `globalThis` (standard, portable across environments) — prefer `globalThis` in new code for consistency with browser/other JS runtime code.
- Mixing CommonJS and ESM files in the same project without understanding interop rules — a `.js` file's module system is determined by the nearest `package.json`'s `"type"` field (or `.mjs`/`.cjs` extension overrides), and mismatches produce confusing `SyntaxError`s about `require`/`import` not being defined.

## Interview Questions & Answers

**Q: Are `__dirname` and `require` truly global in Node.js?**
A: No, despite feeling global, they're actually module-scoped. Node's CommonJS module loader wraps every file's code in an implicit function `(function(exports, require, module, __filename, __dirname) { ... })`, injecting these as parameters unique to that file — so `__dirname` in one file is a different value than in another, unlike a true process-wide global like `process`.

**Q: How do you get the equivalent of `__dirname` in an ES module?**
A: ES modules don't have `__dirname`/`__filename` at all. You derive the equivalent from `import.meta.url`, which gives the current module's URL: `import { fileURLToPath } from 'node:url'; const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);`

**Q: What's the difference between `module.exports` and `exports`, and why does reassigning `exports` sometimes not work as expected?**
A: `exports` starts out as a shorthand reference to the same object as `module.exports`. Mutating properties on `exports` (e.g., `exports.foo = ...`) works because it's mutating the shared object. But assigning `exports = {...}` entirely replaces what the *local variable* `exports` points to, without changing `module.exports` — and since `require()` returns `module.exports`, not the local `exports` variable, that reassignment is invisible to anything requiring the module.

**Q: Why are all values in `process.env` strings, and what problem does that cause?**
A: Environment variables are fundamentally OS-level key-value string pairs — there's no native concept of a boolean or number environment variable. So `process.env.DEBUG` is the string `"true"` or `"false"`, not a boolean, and `if (process.env.DEBUG)` is truthy for *any* non-empty string including `"false"` — a very common bug. Explicit parsing (`process.env.DEBUG === 'true'`, `Number(process.env.PORT)`) is required.

**Q: What determines whether a `.js` file in a Node project is treated as CommonJS or an ES module?**
A: The nearest `package.json`'s `"type"` field — `"type": "module"` makes `.js` files ESM by default (enabling `import`/`export`, disabling `require`/`module.exports`/`__dirname`), while its absence (or `"type": "commonjs"`) treats `.js` as CommonJS. This can be overridden per-file regardless of `package.json` using the `.mjs` (always ESM) or `.cjs` (always CommonJS) extensions.

## Related Topics

- [buffers.md](./buffers.md)
- [process-and-os.md](./process-and-os.md)
- [package-json.md](./package-json.md)
- [console.md](./console.md)
- [util.md](./util.md)
