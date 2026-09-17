# Remote Repositories

A remote is simply a named reference to another copy of the repository — typically hosted on a server (GitHub, GitLab, an internal Git server) — stored as a URL plus a name (conventionally `origin` for the repo you cloned from) in `.git/config`. Git is fully distributed, so a "remote" isn't structurally different from your local repository — it's just another Git repository that you've registered a name and address for, so commands like `fetch` and `push` know where to talk to without you typing a full URL every time. `git remote add <name> <url>` registers one; `git remote -v` lists all registered remotes and their fetch/push URLs (which can differ, though usually don't).

The distinction between `fetch` and `pull` trips people up constantly, and it's a genuinely important one. `git fetch` downloads new commits, branches, and tags from a remote into your local copy of that remote's refs (`refs/remotes/origin/*`) — but it **does not touch your working directory or your local branches at all**. It's purely "go find out what's new on the remote and store it locally," safe to run anytime with zero risk of altering your current work. `git pull` is fetch **plus** an automatic integration step: by default `git pull` = `git fetch` followed by `git merge origin/<branch>` into your current branch (or `git rebase origin/<branch>` if configured with `git pull --rebase` or `pull.rebase=true`), meaning it *does* modify your current branch and working directory, potentially creating a merge commit or triggering conflicts.

A **tracking branch** (or "upstream branch") is a local branch configured to know which remote branch it corresponds to — set automatically when you `git clone` (local `main` tracks `origin/main`) or explicitly via `git push -u origin <branch>` / `git branch --set-upstream-to=origin/<branch>`. Once set, plain `git push` and `git pull` (with no arguments) know exactly where to send/receive from, and `git status` / `git branch -vv` can report how many commits you're ahead/behind the remote without you specifying anything.

`git push` uploads your local commits (and optionally the ref update) to the remote, but only succeeds as a simple push if the remote branch's history is a strict subset of what you're pushing — i.e., a fast-forward. If the remote has commits you don't have locally (because a teammate pushed, or because history was rewritten), a plain push is rejected; you need to `fetch` and reconcile (merge or rebase) first, or, for genuinely rewritten history you intend to overwrite, `git push --force-with-lease` — which refuses the push if the remote moved since your last fetch, unlike a bare `--force`, which overwrites blindly and can destroy a teammate's already-pushed work.

## Examples

```bash
# Register, inspect, and use a remote
git remote add origin https://github.com/anilkapoor/interview-prep.git
git remote -v
# origin  https://github.com/anilkapoor/interview-prep.git (fetch)
# origin  https://github.com/anilkapoor/interview-prep.git (push)

git push -u origin main    # -u sets up tracking: main now tracks origin/main
```

```bash
# fetch vs. pull: fetch is inspect-only, pull also integrates into your branch
git fetch origin
git log main..origin/main --oneline   # see what's new on the remote before touching anything
git diff main origin/main             # review the actual diff

git pull                               # fetch + merge (or rebase, if configured) in one step
git pull --rebase                      # fetch + rebase your local commits on top, instead of merging
```

```bash
# Pushing safely after rewriting local history (e.g., after an interactive rebase)
git push --force-with-lease origin feature/login-form
# Rejected if origin/feature/login-form has moved since your last fetch —
# protects against silently overwriting a teammate's work, unlike plain --force

# See ahead/behind status against the tracked upstream
git status
# Your branch is ahead of 'origin/main' by 2 commits.
git branch -vv
```

## Common Pitfalls / Gotchas

- Treating `git pull` as risk-free like `fetch` — `pull` actively merges (or rebases) into your current branch and can create conflicts or unexpected merge commits, especially with local uncommitted or unpushed work in play.
- Using `git push --force` instead of `--force-with-lease` after rewriting history — plain `--force` overwrites the remote unconditionally, silently destroying any commits a teammate pushed since your last fetch.
- Forgetting to set up tracking (`-u`) on a new branch's first push, then being confused why plain `git push`/`git pull` fail or ask which remote branch to use.
- Assuming `origin` always means "the authoritative/production repository" — it's just a conventional default name for whatever URL you cloned from or first registered; in a fork-based workflow, `origin` is often *your* fork, and `upstream` is the real project.
- Not running `git fetch` before starting work and being surprised that local branches look "behind" — fetch has to be run explicitly (or via `pull`) to learn about new remote activity; Git doesn't silently poll the remote in the background.

## Interview Questions & Answers

**Q: What is the difference between `git fetch` and `git pull`?**
A: `git fetch` downloads new commits, branches, and tags from the remote and updates your local copies of the remote's refs (`refs/remotes/origin/*`) — it never touches your working directory or current branch. `git pull` does a fetch and then automatically integrates the fetched changes into your current branch, by default via a merge (or a rebase, if `pull.rebase` is configured) — meaning it can alter your working directory, create a merge commit, or trigger a conflict, none of which `fetch` alone can do.

**Q: What is a tracking (upstream) branch, and how is it set?**
A: A local branch configured to know which remote branch it corresponds to, so plain `git push`/`git pull` (no arguments) know where to send/receive without specifying a remote and branch every time. It's set automatically for the default branch on `git clone`, or explicitly via `git push -u origin <branch>` (the `-u`/`--set-upstream` flag) or `git branch --set-upstream-to=origin/<branch>` on an existing branch.

**Q: Why would a `git push` be rejected, and how do you resolve it?**
A: A push is rejected when it isn't a fast-forward — the remote branch has commits your local branch doesn't have (a teammate pushed first, or local history was rewritten relative to what's on the remote). Resolve by fetching and reconciling: either `git pull` (merge or rebase the new remote commits into your branch) and push again, or, if you deliberately rewrote history and intend to overwrite the remote, `git push --force-with-lease` after confirming that's actually intended.

**Q: What's the difference between `git push --force` and `git push --force-with-lease`?**
A: Both overwrite the remote branch's history with your local version. Plain `--force` does so unconditionally, with no check on what's currently on the remote — if a teammate pushed new commits since your last fetch, they're silently discarded. `--force-with-lease` first checks that the remote ref is still exactly where your local knowledge of it (from your last fetch) says it should be; if the remote has moved since, the push is refused, protecting against accidentally clobbering someone else's just-pushed work.

**Q: In a fork-based open-source workflow, what do `origin` and `upstream` typically refer to?**
A: `origin` conventionally refers to whatever repository you cloned from — in a fork workflow, that's usually *your own fork*, not the original project. `upstream` is a remote you add explicitly, pointing at the original/canonical repository, so you can `git fetch upstream` to pull in the project's latest changes and keep your fork's `main` in sync, while still pushing your own feature branches to `origin` (your fork) to open pull requests against `upstream`.

## Related Topics

- [git-basics.md](./git-basics.md)
- [branches.md](./branches.md)
- [pull-requests.md](./pull-requests.md)
- [merge-vs-rebase.md](./merge-vs-rebase.md)
