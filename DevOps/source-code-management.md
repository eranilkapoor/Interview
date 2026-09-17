# Source Code Management

Source code management (SCM), also called version control, is the practice of tracking every change to a codebase over time — who made it, when, why, and what exactly changed — so a team can collaborate on the same code without overwriting each other's work and can always get back to any previous state. The historical split is between centralized version control systems (CVCS), like Subversion or Perforce, where there's one authoritative server and every commit talks to it directly, and distributed version control systems (DVCS), like Git or Mercurial, where every developer has a full copy of the entire repository history locally and can commit, branch, and view history completely offline, syncing with a shared remote only when they choose to push or pull. Git won this argument almost entirely — cheap local branching, offline commits, and the ability to rewrite local history before sharing it are why nearly every modern DevOps toolchain assumes Git underneath it.

Branching strategy is where SCM stops being about mechanics and starts being about team workflow and release cadence. **Git-flow** defines long-lived `develop` and `main` branches plus short-lived `feature/*`, `release/*`, and `hotfix/*` branches, with a fairly rigid, well-documented process for merging between them — it works well for projects with scheduled, versioned releases (think: shipping installable software) but adds overhead that's rarely worth it for a service that deploys continuously. **Trunk-based development** is close to the opposite: everyone commits small, frequent changes directly to a single shared branch (`main`/`trunk`), feature branches if they exist at all live for hours or a day at most, and unfinished work is hidden behind feature flags rather than kept off `main` on a branch. Trunk-based development is what makes true continuous integration possible — CI's entire premise (integrate constantly, catch conflicts early) breaks down when branches live for weeks before merging, because that's exactly the long-lived-divergence scenario CI is meant to prevent.

Monorepo versus polyrepo is the other major SCM decision teams have to make: a monorepo keeps many projects/services in one repository with one shared history and one set of tooling, which makes cross-project refactors and dependency version consistency much easier at the cost of a bigger, slower-to-clone repo and coarser access control; a polyrepo gives each project its own repository with independent versioning and access control, which scales access-control and ownership boundaries better at the cost of making cross-repo changes (a shared library update that needs to land in ten services) much more painful to coordinate. Neither is universally correct — Google and Meta famously run enormous monorepos with heavy custom tooling to make them viable at scale, while most smaller organizations default to polyrepo because the tooling investment a monorepo needs isn't worth it below a certain size.

## Examples

```bash
# Trunk-based flow: small commit straight onto main, hidden behind a flag
git checkout main
git pull
# ... make a small change ...
git add .
git commit -m "Add discount calculation behind feature flag"
git push origin main   # triggers CI immediately
```

```bash
# Git-flow style release branch
git checkout -b release/2.4.0 develop
# stabilize: only bug fixes land here, no new features
git checkout main
git merge --no-ff release/2.4.0
git tag v2.4.0
git checkout develop
git merge --no-ff release/2.4.0
```

```bash
# A hotfix branched directly off main, bypassing develop entirely
git checkout -b hotfix/1.9.1 main
# ... fix the critical bug ...
git checkout main
git merge --no-ff hotfix/1.9.1
git tag v1.9.1
```

## Common Pitfalls / Gotchas

- Letting feature branches live for weeks — the longer a branch diverges from main, the more painful (and conflict-prone) the eventual merge, which defeats the purpose of version control's collaboration model.
- Choosing Git-flow by default for a service that deploys continuously — the release-branch ceremony adds overhead with no corresponding benefit when there's no discrete "release" event to stabilize around.
- Committing secrets (API keys, credentials) into history — because Git preserves full history, deleting the file in a later commit does not remove the secret; it requires rewriting history and rotating the credential.
- Choosing monorepo or polyrepo based on trend rather than team size and coordination needs — a monorepo without investment in tooling (fast CI, selective builds) becomes a slow, painful shared bottleneck.
- Force-pushing to a shared branch, rewriting history other people have already based work on.

## Interview Questions & Answers

**Q: What's the difference between centralized and distributed version control?**
A: In a centralized system, there's one server holding the canonical history, and every operation (commit, log, diff against history) needs to talk to it. In a distributed system, every clone contains the entire history, so commits, branches, and history browsing all work fully offline — you only need the network to explicitly push to or pull from a remote. Git's distributed model is also why local branching is cheap and disposable, which enabled workflows like feature-branch and trunk-based development.

**Q: What is trunk-based development, and why does it matter for CI/CD?**
A: It's a branching strategy where changes are committed in small, frequent increments directly to a single shared branch, with unfinished features hidden behind feature flags rather than isolated on long-lived branches. It matters for CI/CD because continuous integration's core benefit — catching integration conflicts within minutes — depends on branches merging back constantly; long-lived branches recreate the "big merge at the end" problem CI exists to eliminate.

**Q: When would you choose Git-flow over trunk-based development?**
A: When the project has genuinely discrete, versioned releases that need stabilization time — shipping installable software with multiple supported versions in the field, for example — where you need a release branch to receive only bug fixes while `develop` keeps moving forward with new features. For a continuously deployed service with a single production version, that stabilization ceremony is usually pure overhead.

**Q: What's the tradeoff between a monorepo and a polyrepo?**
A: A monorepo makes cross-project changes, shared dependency versions, and large-scale refactors easier because everything is in one history with one set of tooling, but it requires investment in scalable build/CI tooling and coarsens access control. A polyrepo gives each project independent versioning, ownership, and access control, but coordinating a change that spans many repos (like a breaking shared-library update) becomes a multi-repo, multi-PR coordination problem.

**Q: If someone accidentally commits a secret to Git, is deleting it in the next commit enough?**
A: No — Git preserves the full history, so the secret is still retrievable from an earlier commit even after a later commit removes it. The correct fix is to treat the credential as compromised and rotate it immediately, and separately rewrite history (e.g. with `git filter-repo` or BFG) if the secret must also be purged from the repository itself.

## Related Topics

- [ci-cd.md](./ci-cd.md)
- [release-strategies.md](./release-strategies.md)
- [secrets-management.md](./secrets-management.md)
