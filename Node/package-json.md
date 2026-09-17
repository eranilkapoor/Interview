# package.json

`package.json` is the manifest file for a Node.js project or package — it declares metadata (name, version, description), how the module system should treat the package (`type`), what other packages it depends on and at which versions, what commands can be run against it (`scripts`), and how its public API is exposed to consumers (`main`, `exports`). Every `npm`/`yarn`/`pnpm` command that installs, publishes, or runs a project reads this file first, and understanding its fields precisely is essential for anything beyond trivial project setup.

`"type"` controls whether `.js` files in the package are treated as CommonJS (`"type": "commonjs"`, the default if omitted) or ES modules (`"type": "module"`). This affects whether `require`/`module.exports` or `import`/`export` syntax is used natively, and it changes how Node resolves extensionless imports. `.cjs` and `.mjs` file extensions override the package-level `type` on a per-file basis regardless of what's declared. The `"exports"` field (replacing the older, simpler `"main"` field for controlling public API) lets a package explicitly define which files are importable from outside, supports conditional exports (different entry points for `import` vs `require`, or for different platforms), and — critically — blocks consumers from deep-importing internal files that aren't explicitly listed, which `"main"` alone never prevented.

`"dependencies"` are packages required at runtime by the package itself. `"devDependencies"` are only needed for development/build/test (linters, test runners, bundlers) and are not installed when a consumer installs your package as a dependency of theirs, nor with `npm install --production` / `npm ci --omit=dev`. `"peerDependencies"` declare a package the *consumer* is expected to provide themselves (classic example: a React component library declaring `react` as a peer dependency rather than bundling its own copy, to avoid multiple conflicting React instances). `"engines"` declares which Node/npm versions the package is compatible with — it doesn't enforce anything by default, but tools and CI can be configured to respect it, and `npm install` will warn (or fail, with `engine-strict`) on a mismatch.

Semver ranges in dependency versions control how permissive updates are: `^1.2.3` allows updates that don't change the leftmost non-zero digit (so up to but excluding `2.0.0` — effectively "compatible" per semver's meaning of minor/patch = non-breaking), while `~1.2.3` allows only patch-level updates (up to but excluding `1.3.0`). An exact version (`1.2.3`) pins precisely. `package-lock.json` (or `yarn.lock`/`pnpm-lock.yaml`) records the *exact* resolved version of every package in the dependency tree — including transitive dependencies — at install time, so that `npm ci` reproduces byte-identical `node_modules` across machines and CI runs, independent of what new versions might satisfy the semver ranges in `package.json` at some later date. Without the lockfile, two installs run weeks apart could silently pull in different transitive dependency versions.

## Examples

```json
{
  "name": "@acme/order-service",
  "version": "2.4.1",
  "type": "module",
  "main": "./dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./client": "./dist/client.js"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "node --test",
    "lint": "eslint ."
  },
  "dependencies": {
    "express": "^4.19.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "eslint": "^9.9.0"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  }
}
```
This manifest declares an ES module package (`"type": "module"`), restricts its public API to exactly two entry points via `"exports"` (deep imports like `require('@acme/order-service/dist/internal-helper.js')` are blocked), and pins a minimum supported Node version.

```js
// Reading package.json metadata programmatically at runtime (e.g. for a --version flag)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkgPath = fileURLToPath(new URL('./package.json', import.meta.url));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

console.log(`${pkg.name} v${pkg.version}`);
```

```js
// Enforcing the engines field manually at startup, since npm doesn't block runtime by default
import { readFileSync } from 'node:fs';
import semver from 'semver'; // hypothetical use of the popular `semver` npm package

const { engines } = JSON.parse(readFileSync('./package.json', 'utf8'));

if (engines?.node && !semver.satisfies(process.version, engines.node)) {
  console.error(`Requires Node ${engines.node}, but running ${process.version}`);
  process.exit(1);
}
```

## Common Pitfalls / Gotchas

- Committing `node_modules` but not `package-lock.json`, or the reverse mistake of `.gitignore`-ing the lockfile — the lockfile should always be committed so builds are reproducible; `node_modules` should not be.
- Putting build/test tools (TypeScript, ESLint, Jest) in `"dependencies"` instead of `"devDependencies"` — this bloats the installed footprint for anyone consuming your package and gets installed unnecessarily in production installs.
- Misunderstanding `^` vs `~`: `^1.2.3` allows minor and patch updates (up to `<2.0.0`), `~1.2.3` allows only patch updates (up to `<1.3.0`) — assuming they're interchangeable can lead to unexpectedly large automatic version bumps.
- Setting `"type": "module"` without updating code that still uses `require`/`module.exports`, breaking the whole package until converted (or renaming the CommonJS files to `.cjs`).
- Defining `"main"` but not `"exports"` and assuming deep imports are blocked — without an `"exports"` map, any file in the package is importable by path from outside, which the `"exports"` field is specifically designed to prevent.
- Declaring a dependency both as a regular dependency and a peer dependency inconsistently, or forgetting to also list a peer dependency in `devDependencies` so it's available for the package's own tests.
- Running `npm install` instead of `npm ci` in CI pipelines — `install` can update the lockfile and resolve slightly different versions if the range allows it, while `ci` strictly installs exactly what the lockfile specifies and fails if `package.json` and the lockfile are out of sync.
- Forgetting that `"engines"` is advisory by default — it doesn't stop `npm install` or `node` from running on an incompatible version unless the ecosystem tooling is explicitly configured to enforce it (e.g., `npm config set engine-strict true`).

## Interview Questions & Answers

**Q: What's the difference between `dependencies`, `devDependencies`, and `peerDependencies`?**
A: `dependencies` are required at runtime and get installed whenever your package is installed, including as a dependency of another project. `devDependencies` are only needed for local development, building, or testing, and are skipped in production installs (`npm ci --omit=dev`). `peerDependencies` declare a package your code expects the *consumer* to already have installed (commonly a framework like React), so the consumer's own copy is used rather than bundling a duplicate, which avoids version conflicts and duplicate instances.

**Q: What is the difference between `^1.2.3` and `~1.2.3` in a semver range?**
A: `^1.2.3` permits any update that doesn't change the leftmost non-zero version component, so it allows `1.3.0`, `1.9.9`, but not `2.0.0` — effectively "anything semver-compatible." `~1.2.3` is stricter and only allows patch-level updates, so `1.2.9` is fine but `1.3.0` is not. `^` is the npm default when you run `npm install <pkg>`.

**Q: What problem does `package-lock.json` solve that `package.json` alone doesn't?**
A: `package.json` specifies acceptable version *ranges*, not exact versions, and that applies transitively through the whole dependency tree. Without a lockfile, two installs at different times could resolve different actual versions for the same ranges (especially for nested/transitive dependencies), producing subtly different `node_modules` and inconsistent behavior across machines or CI runs. `package-lock.json` pins the exact resolved version (and integrity hash) of every package in the tree, so `npm ci` reproduces an identical install every time.

**Q: What does `"type": "module"` change about how Node treats your code?**
A: It makes Node treat `.js` files in that package as ES modules by default — using `import`/`export` syntax natively, top-level `await`, and different module resolution rules (e.g., requiring explicit file extensions in relative imports) — instead of the CommonJS default (`require`/`module.exports`). `.mjs` files are always ES modules and `.cjs` files are always CommonJS regardless of the `"type"` field, which is useful for gradually migrating or for packages that need to ship both formats.

**Q: What is the `"exports"` field for, and how does it differ from `"main"`?**
A: `"main"` historically just pointed to a package's default entry file, but placed no restriction on what else could be imported — any file in the package was importable by its file path. `"exports"` explicitly defines the complete public API surface: which subpaths are importable (and optionally, different files per condition like `import` vs `require`, or per platform). Any file not listed in `"exports"` becomes unimportable from outside the package, which lets package authors enforce encapsulation of internal implementation files.

## Related Topics
- [releases.md](./releases.md)
- [error-handlings.md](./error-handlings.md)
- [security.md](./security.md)
- [globals.md](./globals.md)
- [unit-tests.md](./unit-tests.md)
