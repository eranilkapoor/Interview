# Git Flow

Git Flow is a specific, structured branching model (popularized by Vincent Driessen in 2010) built around two permanent branches and three types of temporary supporting branches, each with a defined role and defined merge direction. `main` (historically `master`) always reflects production-ready, released code — every commit on it is, in principle, a tagged release. `develop` is the integration branch where completed features accumulate between releases; it's always ahead of or equal to the latest release, never behind. Feature work never touches `main` directly.

The three supporting branch types each solve a specific problem. `feature/*` branches fork from `develop` and merge back into `develop` once complete — they hold in-progress work for a single feature and can live as long as needed since they're never released directly. `release/*` branches fork from `develop` when it has accumulated enough for a release; they're for final stabilization (version bumps, last-minute bug fixes, no new features), and once ready they merge into *both* `main` (tagged as the new release) and back into `develop` (so any fixes made during stabilization aren't lost). `hotfix/*` branches fork directly from `main` to patch an urgent production bug without waiting for the next full release cycle, then merge into both `main` (tagged as a new patch release) and `develop`, same dual-merge pattern as a release branch.

Git Flow's structure makes sense for products with genuinely scheduled, versioned releases — desktop software, mobile apps with app-store review cycles, embedded firmware, anything where "ship whenever a feature is done" isn't an option and multiple release versions may need parallel support (patching v2.3 while v3.0 is in development). Its cost is real: more branches to track, a merge (not just a PR) required at multiple points per release, and a heavier mental model than teams practicing continuous deployment typically need.

The main alternative, **trunk-based development**, uses effectively one long-lived branch (`main`/`trunk`) with only short-lived feature branches (hours to a couple of days) merged in frequently, often gated by feature flags rather than by branches for anything not ready to ship. **GitHub Flow** sits in between: a single `main` that's always deployable, short-lived feature branches merged via pull request after review, and deployment straight from `main` (or tags cut from it) — no `develop`, no `release/*`, no `hotfix/*`, because there's no separate "next release" to stabilize; `main` *is* what ships next, continuously. Most modern web/SaaS teams doing continuous delivery favor GitHub Flow or trunk-based development specifically because Git Flow's release-branch ceremony assumes a release cadence they no longer have.

## Examples

```bash
# Feature branch: forks from develop, merges back into develop
git checkout develop
git checkout -b feature/checkout-redesign
# ...work, commit...
git checkout develop
git merge --no-ff feature/checkout-redesign   # --no-ff preserves the feature's
git branch -d feature/checkout-redesign        # branch shape in history
```

```bash
# Release branch: stabilize develop, then ship to main AND fold back into develop
git checkout develop
git checkout -b release/2.4.0
# ...version bump, final bug fixes, no new features...
git checkout main
git merge --no-ff release/2.4.0
git tag -a v2.4.0 -m "Release 2.4.0"
git checkout develop
git merge --no-ff release/2.4.0                # so develop keeps the stabilization fixes
git branch -d release/2.4.0
```

```bash
# Hotfix branch: urgent patch straight from main, without waiting for next release
git checkout main
git checkout -b hotfix/2.4.1
# ...fix the critical bug...
git checkout main
git merge --no-ff hotfix/2.4.1
git tag -a v2.4.1 -m "Hotfix 2.4.1"
git checkout develop
git merge --no-ff hotfix/2.4.1                 # bring the fix into develop too
git branch -d hotfix/2.4.1
```

## Common Pitfalls / Gotchas

- Forgetting to merge a `release/*` or `hotfix/*` branch back into `develop` as well as `main` — the fix ships in production but silently vanishes from the next release's baseline, only to "reappear" as a bug later.
- Adopting Git Flow's full ceremony for a team doing continuous deployment multiple times a day — the release-branch/dual-merge overhead actively slows down teams that don't have a real "next scheduled release" concept.
- Long-lived `feature/*` branches drifting far from `develop` before merging, causing painful conflicts — Git Flow doesn't prevent this on its own; it still requires disciplined, frequent integration.
- Confusing Git Flow's `develop` with GitHub Flow's or trunk-based development's single `main` — they are not interchangeable models, and mixing conventions (e.g., deploying straight from `develop` while also running release branches) creates confusion about what's actually in production.
- Tagging releases inconsistently or forgetting to tag at all, losing the ability to correlate a production incident with the exact commit that was deployed.

## Interview Questions & Answers

**Q: Describe the branch structure of Git Flow.**
A: Two permanent branches — `main` (always production-ready/released) and `develop` (integration branch for completed work between releases) — plus three supporting branch types: `feature/*` (forks from and merges back into `develop`), `release/*` (forks from `develop` for final stabilization, merges into both `main` and `develop`), and `hotfix/*` (forks from `main` for urgent production patches, merges into both `main` and `develop`).

**Q: Why does a `release/*` or `hotfix/*` branch merge into both `main` and `develop`?**
A: Because both branches need to end up consistent with whatever shipped. `main` needs the actual release/patch. `develop` needs it too — otherwise any last-minute fixes made during release stabilization (or an urgent hotfix) would only exist on `main` and would be silently lost/reintroduced as a bug the next time `develop` is eventually released, since `develop` never received the fix.

**Q: How does Git Flow differ from trunk-based development?**
A: Git Flow uses multiple long-lived branches (`main`, `develop`) plus several supporting branch types with defined merge rules, suited to scheduled, versioned releases where multiple versions might need parallel support. Trunk-based development uses a single long-lived branch with only short-lived (hours-to-days) feature branches merged in frequently, usually paired with feature flags to hide incomplete work — favoring continuous integration and continuous deployment over release-cycle ceremony.

**Q: How does GitHub Flow differ from Git Flow?**
A: GitHub Flow has just one long-lived branch, `main`, which is always deployable. Feature work happens on short-lived branches merged into `main` via pull request after review, and deployment happens directly from `main` (or a tag cut from it). There's no `develop`, no `release/*`, no `hotfix/*` — because there's no separate "next release" being stabilized; `main` continuously represents what's shippable next, which fits continuous delivery much better than Git Flow's release-branch model.

**Q: When would you actually recommend Git Flow over a simpler model today?**
A: When the product has genuine, infrequent, versioned releases that must be independently maintainable — e.g., installed desktop/mobile software with app-store review lag, or a library/firmware where multiple major versions (v2.x, v3.x) need parallel bug-fix support simultaneously. For a continuously deployed web service or SaaS product, the release-branch ceremony is usually unnecessary overhead, and GitHub Flow or trunk-based development is a better fit.

## Related Topics

- [branches.md](./branches.md)
- [merge-vs-rebase.md](./merge-vs-rebase.md)
- [pull-requests.md](./pull-requests.md)
- [tags.md](./tags.md)
- [remote-repositories.md](./remote-repositories.md)
