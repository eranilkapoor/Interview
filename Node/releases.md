# Node.js Release Cycle

Node.js follows a predictable, time-based release cycle: a new major version ships roughly every six months (April and October), and version numbers alternate in significance by parity — even-numbered major versions (18, 20, 22, 24...) become Long Term Support (LTS) releases, while odd-numbered majors (19, 21, 23...) are "Current" releases that never receive LTS status and reach end-of-life shortly after the next release ships. This predictability is deliberate: it lets teams plan upgrades around a known cadence instead of reacting to ad hoc releases.

A release line moves through defined phases. A new even-numbered major starts as "Current" for about six months after release, during which it can still receive semver-major changes and isn't yet recommended for production. It then enters "Active LTS" (typically for about 12 months), where it receives only backwards-compatible bug fixes, security patches, performance improvements, and select new features — this is the phase recommended for production use, offering stability plus ongoing support. After Active LTS, it moves to "Maintenance LTS" (roughly another 18 months), where it receives critical bug fixes and security patches only, no new features. Finally it reaches "End-of-Life" (EOL), after which it receives no updates at all, including security patches — running an EOL version in production is a real security liability, since known vulnerabilities discovered afterward will never be patched in that line.

Odd-numbered releases (Current-only lines like 19, 21, 23) exist to let new features and larger changes land and be tested by early adopters between LTS cycles, but they're short-lived — typically supported for only about 6 months total, with no LTS phase — so they're appropriate for experimentation or libraries wanting to test compatibility ahead of time, but not for production services that need long-term support.

In practice, choosing a Node version for a new production service means picking the current Active LTS release (checking the official release schedule, since exact version numbers shift over time) — new enough to get modern features and reasonably long remaining support, but stable enough to have already passed its initial Current phase. Managing multiple Node versions on one machine (for testing across versions, or working across projects pinned to different LTS lines) is typically done with a version manager like `nvm` (`nvm install 20`, `nvm use 20`) or `nvm-windows`/`fnm`/`volta`, combined with an `"engines"` field in `package.json` and often a `.nvmrc` file to document/enforce the expected version per project.

## Examples

```bash
# Using nvm to install and switch between LTS lines (illustrative shell usage, not Node API)
nvm install 20          # install latest Node 20.x (Active/Maintenance LTS depending on date)
nvm install 22          # install latest Node 22.x
nvm use 20               # switch the current shell to Node 20
nvm alias default 20     # make Node 20 the default for new shells
node --version
```

```js
// Checking the running Node version programmatically, e.g. to gate a feature
// that depends on a minimum runtime version
const [major] = process.versions.node.split('.').map(Number);

if (major < 20) {
  console.error(`This service requires Node 20+ (running ${process.version}).`);
  process.exit(1);
}

console.log('Node version check passed:', process.version);
```

```json
{
  "name": "order-service",
  "engines": {
    "node": ">=20.0.0 <23.0.0"
  }
}
```
Combined with a `.nvmrc` file containing `20`, this documents and (with `engine-strict` or CI checks) helps enforce that contributors and deployment environments use a supported LTS version rather than drifting to an untested one.

## Common Pitfalls / Gotchas

- Deploying to production on an odd-numbered "Current" release (e.g., Node 21) — these never get an LTS phase and reach end-of-life quickly, leaving production on an unsupported version far sooner than expected.
- Letting a production service silently age onto an End-of-Life Node version — EOL lines receive no further security patches, so newly discovered vulnerabilities in V8, OpenSSL, or Node internals go unfixed.
- Assuming `"engines"` in `package.json` actually blocks installation/execution on the wrong version — by default it's advisory only (a warning, not an error) unless the environment explicitly enforces it.
- Upgrading straight from one LTS line to a much newer one without reading the release notes/breaking changes for every major version skipped — each major can include breaking changes even within the "LTS" umbrella term (LTS means support duration, not that it's changeless).
- Confusing "Active LTS" with "Maintenance LTS" — Active LTS still receives feature additions (non-breaking); Maintenance LTS is critical-fixes-only and is generally the point to start planning a migration to the next line.
- Not pinning a Node version in CI/deployment configuration, causing "works on my machine" bugs when local, CI, and production environments silently drift to different Node minor/patch versions.
- Forgetting that global version managers like `nvm` change the version per shell session, not system-wide, which can cause confusion when a background service or cron job runs under a different Node version than an interactive shell.

## Interview Questions & Answers

**Q: What determines whether a Node.js release becomes an LTS version?**
A: Parity of the major version number: even-numbered majors (18, 20, 22, ...) are designated LTS, odd-numbered majors (19, 21, 23, ...) are Current-only and never receive LTS status. This alternation happens automatically as part of Node's roughly six-month major release cadence (April/October).

**Q: What are the phases a Node.js LTS release line goes through?**
A: Current (initial ~6 months after release, still eligible for larger changes, not yet recommended for production) → Active LTS (~12 months, backwards-compatible fixes and select features, the recommended phase for production) → Maintenance LTS (~18 months, critical bug/security fixes only) → End-of-Life (no further updates of any kind).

**Q: Why shouldn't you run a production service on an odd-numbered Node release like 21 or 23?**
A: Odd-numbered releases never enter an LTS phase — they're short-lived "Current" releases meant for testing new features early, and they reach end-of-life only months after shipping. Production services need the longer support window (and security patch guarantees) that only an even-numbered LTS line provides.

**Q: How would you choose which Node version to standardize on for a new project?**
A: Pick the current Active LTS release at the time (checked against the official Node release schedule, since exact numbers change), rather than the newest Current release or an old Maintenance LTS nearing end-of-life. Active LTS balances having reasonably modern features and APIs against a long remaining support and security-patch window. Pin it explicitly via `"engines"` in `package.json` and a `.nvmrc`/CI configuration so all environments match.

**Q: What's the practical difference between using `nvm` and just relying on a system-installed Node?**
A: A system-wide Node install ties every project on the machine to one version, which breaks down the moment you work across projects pinned to different LTS lines, or need to test compatibility across versions. `nvm` (or `fnm`/`volta`) lets you install multiple Node versions side by side and switch between them per shell/project (often automatically via a `.nvmrc` file), which matches how real teams manage version upgrades incrementally across many services.

## Related Topics
- [package-json.md](./package-json.md)
- [process-and-os.md](./process-and-os.md)
- [v8.md](./v8.md)
- [security.md](./security.md)
