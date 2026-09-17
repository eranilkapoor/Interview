# Tags

A tag is a named pointer to a specific commit, conceptually similar to a branch but meant to mark a fixed point in history permanently rather than move forward — you use tags to mark release points (`v1.0.0`, `v2.3.1`) so they can be referred to by a stable, human-readable name long after the commit itself has scrolled far back in history. Unlike a branch, a tag doesn't move when you commit; once created, `v1.0.0` always refers to the same commit unless someone explicitly deletes and recreates it (which is bad practice for published tags, for the same reason rewriting published commit history is).

Git has two genuinely different kinds of tags. A **lightweight tag** is essentially the same thing as a branch ref, minus the "moves forward on commit" behavior — just a file under `.git/refs/tags/<name>` holding a commit SHA directly, with no additional metadata. An **annotated tag** (`git tag -a`) is a full Git object of its own: it stores the tagger's name and email, the tag date, a message (like a commit message), and optionally a GPG signature (`git tag -s`) — and it points *at* the commit rather than *being* a bare pointer to it. Annotated tags are what `git describe` uses, show up with their own metadata in `git show <tag>`, and are the generally recommended choice for anything meant to represent an actual release, precisely because of that extra provenance and message.

The near-universal convention for naming release tags is **Semantic Versioning** (`MAJOR.MINOR.PATCH`, e.g., `v2.4.1`): increment `MAJOR` for breaking/incompatible changes, `MINOR` for backward-compatible new functionality, and `PATCH` for backward-compatible bug fixes. This convention exists specifically so consumers of a versioned package/library can reason about upgrade risk from the version number alone — bumping only `PATCH` should, by convention, never break anything depending on that package, while a `MAJOR` bump is an explicit signal that it might.

A frequently-missed detail: `git push` does **not** push tags by default, exactly like it doesn't push arbitrary new branches without `-u`/explicit naming — tags have to be pushed explicitly, either individually (`git push origin v1.0.0`) or all at once (`git push --tags`, or `git push --follow-tags` to push only annotated tags reachable from what you're already pushing). This is a deliberate design choice, since local, temporary tags (personal bookmarks, WIP markers) shouldn't automatically leak to the remote just because you happened to push a branch.

## Examples

```bash
# Lightweight tag: just a pointer, no extra metadata
git tag v1.0.0-rc1
git show v1.0.0-rc1
# shows the commit directly — no tagger/date/message of its own

# Annotated tag: a real Git object with message, tagger, date, optional signature
git tag -a v1.0.0 -m "First stable release"
git show v1.0.0
# tag v1.0.0
# Tagger: Anil Kapoor <you@example.com>
# Date:   Wed Sep 17 2026
#
# First stable release
#
# commit a1b2c3d...   <- the commit it points at, shown below the tag's own metadata
```

```bash
# Tags are NOT pushed automatically — must be pushed explicitly
git push origin v1.0.0            # push one specific tag
git push --tags                   # push every local tag not yet on the remote
git push --follow-tags            # push only annotated tags reachable from pushed commits

# Tag an older commit retroactively, not just HEAD
git tag -a v0.9.0 5c4d3e2 -m "Beta release"
```

```bash
# Listing, filtering, and deleting tags
git tag -l "v1.*"                 # list tags matching a pattern
git tag -d v1.0.0-rc1              # delete a local tag
git push origin --delete v1.0.0-rc1   # delete it from the remote too (separate step)

# Checking out a tag (results in detached HEAD, since a tag doesn't move)
git checkout v1.0.0
git switch -c hotfix/v1.0.1 v1.0.0    # branch off a tag to patch an old release
```

## Common Pitfalls / Gotchas

- Assuming `git push` uploads tags along with commits — it doesn't; tags require an explicit `git push origin <tag>` or `git push --tags`.
- Using lightweight tags for real releases — they carry no tagger, date, message, or signature, losing useful provenance that annotated tags provide essentially for free.
- Deleting and recreating a tag that's already been pushed and potentially depended on (e.g., by CI/CD, package registries, or other people's clones) — like rewriting shared commit history, this silently breaks anyone who already resolved that tag name to the old commit.
- Forgetting that checking out a tag puts you in detached HEAD state (since tags don't move and aren't branches) — new commits made there need `git switch -c <branch>` first, or they become effectively unreachable once you check out something else.
- Not following semantic versioning consistently, making it hard for consumers to judge upgrade risk from the version number alone — e.g., shipping a breaking change as a `PATCH` bump.

## Interview Questions & Answers

**Q: What's the difference between a lightweight tag and an annotated tag?**
A: A lightweight tag is just a ref file pointing directly at a commit SHA — no additional metadata, functionally similar to an immovable branch. An annotated tag (`git tag -a`) is a full Git object in its own right, storing the tagger's name/email, a timestamp, a message, and optionally a GPG signature, and it points *at* the commit rather than being a bare pointer to it. Annotated tags are generally recommended for actual releases because of that extra provenance.

**Q: Why doesn't `git push` upload tags by default?**
A: Because tags, like branches, are local refs that might be personal or temporary (bookmarks, WIP markers) and shouldn't automatically become public just because you pushed unrelated commits. Pushing tags is an explicit, separate action — `git push origin <tag-name>` for one tag, or `git push --tags`/`--follow-tags` to push multiple — mirroring the general principle that Git doesn't publish local refs implicitly.

**Q: Explain semantic versioning and why it's the standard convention for release tags.**
A: `MAJOR.MINOR.PATCH` — `MAJOR` increments for breaking/incompatible API changes, `MINOR` for backward-compatible new features, `PATCH` for backward-compatible bug fixes. It's standard because it lets consumers reason about upgrade risk purely from the version number: bumping only `PATCH` should be safe to take automatically, while a `MAJOR` bump is an explicit signal that manual review/migration may be needed before upgrading.

**Q: Why would you check out a tag, and what state does that leave your repository in?**
A: You'd check out a tag to inspect or build the exact code from a specific release, or to branch off an old release to produce a hotfix for it. Since a tag is a fixed, non-moving pointer (not a branch), checking it out directly puts you in detached HEAD state — you can look around and even build/run at that commit, but any new commits made there need `git switch -c <branch-name>` immediately to have a branch holding onto them, or they risk becoming unreachable once you check out something else.

**Q: Is it ever acceptable to delete and recreate a tag that points at the wrong commit?**
A: Only if the tag has not yet been pushed/shared — exactly the same rule as rewriting unshared commits. Once a tag has been pushed and potentially consumed by others (CI/CD pipelines, package registries, other developers' clones resolving that tag name), moving it is equivalent to rewriting published history under a name people already trust as fixed; the safer fix is to cut a new tag (e.g., `v1.0.1`) rather than force-moving `v1.0.0` out from under anyone already relying on it.

## Related Topics

- [git-flow.md](./git-flow.md)
- [commits.md](./commits.md)
- [remote-repositories.md](./remote-repositories.md)
- [branches.md](./branches.md)
