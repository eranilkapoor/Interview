# Branches

A Git branch is nothing more than a movable, lightweight pointer to a single commit — internally it's a 41-byte file under `.git/refs/heads/<name>` containing the SHA of the commit it currently points at. There is no separate storage for "the code on a branch"; a branch just names a commit, and that commit's parent chain *is* the branch's history. This is why creating a branch in Git is instant regardless of repository size — `git branch feature` just writes one small file — unlike centralized systems (old-school SVN, for example) where branching could mean copying an entire directory tree on the server.

`HEAD` is a special pointer that tracks which branch (or, in "detached HEAD" state, which specific commit) you currently have checked out. When you commit, Git creates a new commit object whose parent is the current commit, then moves the branch that `HEAD` points to forward to the new commit — `HEAD` itself doesn't move relative to the branch, the branch moves and `HEAD` just follows it. If you check out a raw commit SHA or tag instead of a branch, `HEAD` points directly at a commit rather than at a branch ref; that's "detached HEAD," and any new commits you make there aren't reachable from any branch unless you create one to hold them before switching away.

`git switch` and `git checkout -b` both create a new branch pointer at the current commit and move `HEAD` to it; the difference is purely which commit that pointer starts at relative to where you were. Deleting a branch (`git branch -d`) only deletes the pointer/ref — the commits themselves stay in the object database, unreachable but not immediately garbage collected, until Git's periodic `git gc` eventually prunes genuinely unreachable objects after the reflog expiry window passes. This is exactly why a deleted branch's work is usually still recoverable via `git reflog` for a while after the fact.

Because branches are so cheap, a huge part of using Git well in a team is branching *strategy* — how you name branches, how long they live, and how/when they merge back — rather than the mechanics of branching itself. Short-lived feature branches merged frequently (trunk-based development) minimize merge conflicts and integration risk; long-lived branches (Git Flow's `develop`, `release/*`) trade that off for more structured release management. Both are valid depending on team size, release cadence, and CI/CD maturity.

## Examples

```bash
# Create and switch to a new branch off the current commit
git switch -c feature/login-form
# Equivalent older syntax:
git checkout -b feature/login-form

# List branches, see which one HEAD is on, and see their tracking info
git branch -vv
# * feature/login-form  a1b2c3d [origin/feature/login-form] Add form validation
#   main                9f8e7d6 [origin/main] Update README
```

```bash
# See exactly what a branch "is" — just a ref pointing at a commit SHA
git rev-parse feature/login-form
cat .git/refs/heads/feature/login-form   # same SHA, stored as a plain text file

# Renaming and deleting branches
git branch -m feature/login-form feature/login-ui   # rename
git branch -d feature/login-ui                       # safe delete (must be merged)
git branch -D old-experiment                         # force delete, even if unmerged
```

```bash
# Detached HEAD: checking out a commit directly instead of a branch
git checkout a1b2c3d
# You are in 'detached HEAD' state...
git log --oneline -1        # you can look around, even commit here
git switch -c rescue-branch # but create a branch NOW if you want to keep new work
```

## Common Pitfalls / Gotchas

- Making commits in detached HEAD state and then switching to another branch without creating a branch to hold them first — those commits become unreachable from any ref and are only recoverable (briefly) via `git reflog`.
- Confusing `git branch -d` (safe delete, refuses if the branch has unmerged commits) with `git branch -D` (force delete, silently discards unmerged commits' only pointer).
- Assuming `git branch feature` also switches you onto it — it only creates the pointer; you're still on your original branch until you `git checkout feature` / `git switch feature`.
- Long-lived, rarely-merged feature branches drifting so far from `main` that the eventual merge/rebase becomes a painful, conflict-heavy event — a strong argument for merging small and often.

## Interview Questions & Answers

**Q: What is a Git branch, technically?**
A: A branch is a human-readable, movable pointer (a ref) stored as a small file under `.git/refs/heads/` that holds the SHA of a single commit. It's not a copy of files or a separate history stream — the "history of a branch" is just whatever commits are reachable by walking parent pointers from that commit. Because it's just a pointer, creating one is an O(1) operation.

**Q: What does "detached HEAD" mean, and why is it risky?**
A: Normally `HEAD` points at a branch, and the branch points at a commit. In detached HEAD, `HEAD` points directly at a commit instead — you checked out a SHA, a tag, or a remote branch directly rather than a local branch. It's risky because any commits you make there have no branch pointing at them; as soon as you switch away, they become unreachable from normal Git commands (though still recoverable briefly via `git reflog`) unless you first run `git switch -c <name>` to give them a home.

**Q: What actually happens when you delete a branch with `git branch -d`?**
A: Git removes the ref file (the pointer), nothing more. The commits that branch pointed to are untouched in the object database — they just become unreachable if no other ref (branch, tag) points to them or their ancestors. `-d` specifically checks that the branch is fully merged into its upstream/current branch before allowing the delete, as a safety check; `-D` skips that check entirely.

**Q: Why is branching in Git considered "cheap" compared to older version control systems?**
A: Because a branch is just a pointer to a commit, not a copy of the codebase. Creating one means writing a small ref file, not duplicating files or directories on disk or on a server, so it's instant and takes negligible space regardless of repo size — encouraging frequent, disposable branches for small tasks rather than treating branching as an expensive, ceremony-heavy operation.

**Q: Compare trunk-based development with Git Flow's branching model.**
A: Trunk-based development keeps a single long-lived branch (`main`/`trunk`) that everyone commits to directly or via very short-lived feature branches merged within a day or two, favoring continuous integration and small, frequent merges. Git Flow introduces multiple long-lived branches (`main`, `develop`) plus supporting branches (`feature/*`, `release/*`, `hotfix/*`) with defined merge rules between them, favoring structured, scheduled releases at the cost of more merge overhead and branches that can drift significantly before integrating.

## Related Topics

- [commits.md](./commits.md)
- [merge-vs-rebase.md](./merge-vs-rebase.md)
- [git-flow.md](./git-flow.md)
- [reflog.md](./reflog.md)
- [cherry-pick.md](./cherry-pick.md)
