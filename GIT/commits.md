# Commits

A commit is Git's fundamental unit of history: an immutable snapshot of the *entire* project's tracked files at a point in time, plus metadata — author, committer, timestamp, commit message, and a pointer to its parent commit (or multiple parents, for a merge commit). Contrary to a common misconception, a commit is not a "diff"; internally it points to a tree object representing the complete state of every file, and Git computes diffs on demand by comparing two commits' trees. Storing full snapshots (with aggressive deduplication and delta compression under the hood) rather than incremental diffs is what makes operations like checking out an arbitrary historical commit fast and simple.

Every commit is identified by a SHA hash computed over its content — the tree it points to, its parent SHA(s), author/committer info, and message. Because the hash covers the parent pointer too, commits form an immutable, tamper-evident chain: changing anything about an old commit (even just its message) changes its hash, which changes the hash of every commit after it. This is precisely why "editing history" (amend, rebase, filter-branch) is really "creating new commits that replace old ones," never true in-place mutation — and why rewriting commits that have already been pushed and pulled by others is dangerous: everyone else's history now points at commits that no longer exist on the canonical timeline.

Day to day, `git commit -m "message"` takes whatever is currently in the staging area (the index) and turns it into a new commit object, then moves the current branch pointer forward to it. `git commit -am "message"` is a shortcut that auto-stages modifications to already-tracked files before committing (it will not pick up brand-new untracked files). `git commit --amend` doesn't edit the last commit in place — it creates a brand-new commit with the combined changes and a new SHA, then moves the branch pointer to replace the old commit with it; the old commit object still technically exists (recoverable via reflog) but is no longer reachable from the branch.

Good commit hygiene matters more in interviews and in real teams than people expect: a commit should represent one logical, coherent change — small enough to review and revert independently, large enough to actually mean something (not "wip" 40 times a day, though local squashing before pushing/opening a PR can clean that up). Commit message conventions — a short imperative-mood summary line (e.g., "Fix null pointer in login handler," not "Fixed" or "Fixing"), a blank line, then optional body explaining *why* rather than restating *what* the diff already shows — are a recurring interview and code-review topic because they directly affect how usable `git log`, `git blame`, and `git bisect` are months later.

## Examples

```bash
# Basic commit workflow
git add src/auth.ts src/auth.test.ts
git commit -m "Add token refresh handling to auth client"

# Shortcut: stage all tracked-file modifications and commit in one step
git commit -am "Fix off-by-one error in pagination"
# Note: -a will NOT pick up new untracked files, only modifications/deletions
# to files Git already tracks.
```

```bash
# Amend the most recent commit — e.g., you forgot a file or want to fix the message
git add forgotten-file.ts
git commit --amend -m "Add token refresh handling to auth client (updated)"
# This creates a NEW commit object and moves the branch pointer to it.
# Never amend a commit that has already been pushed and pulled by others.
```

```bash
# Inspect commit metadata and content
git show a1b2c3d                 # full diff + metadata for one commit
git log --oneline -5             # SHA + summary line, last 5 commits
git log -p -- src/auth.ts        # full history of changes to one file
git log --author="Anil"          # filter by author
```

## Common Pitfalls / Gotchas

- Treating `git commit --amend` as "editing the old commit" rather than understanding it replaces the commit with a new SHA — amending a commit that's already been pushed forces anyone who pulled it into a history-reconciliation problem.
- Writing vague messages ("fix," "update," "wip") that make `git log` and `git blame` useless months later when trying to understand *why* a change was made.
- Bundling unrelated changes into one giant commit, making it impossible to `git revert` just one part of it or to review it meaningfully.
- Forgetting that `git commit -a` skips new untracked files entirely — a genuinely new file needs at least one explicit `git add` before `-a` will include its future modifications.
- Committing generated files, secrets, or `node_modules`-style directories because `.gitignore` wasn't set up before the first commit — once committed, removal requires `git rm --cached` (or history rewriting for secrets already pushed).

## Interview Questions & Answers

**Q: What exactly does a commit store — a snapshot or a diff?**
A: A full snapshot. Each commit points to a tree object representing the complete state of every tracked file at that point, not an incremental diff from the parent. Git computes diffs on the fly by comparing two commits' trees when you run `git diff` or `git show`; nothing is stored as a diff on disk. Deduplication of identical file content (via content-addressed blobs) is what keeps this space-efficient despite being "full snapshots."

**Q: What determines a commit's SHA, and why does that matter for history rewriting?**
A: The SHA is a hash of the commit's content: its tree, its parent SHA(s), author, committer, timestamps, and message. Because the parent pointer is part of what's hashed, every commit's identity is entangled with its entire ancestry — changing anything about an old commit changes its SHA, which changes every descendant commit's SHA too. That's why operations like `--amend`, `rebase`, and `filter-branch` are described as "rewriting history": they don't mutate objects, they create new ones and move refs to point at the new chain.

**Q: What's the difference between `git commit -m` and `git commit -am`?**
A: `-m` just supplies the commit message; it commits whatever is currently staged. `-a` additionally auto-stages modifications and deletions to files Git already tracks before committing — but it never stages brand-new untracked files, since there's no existing index entry for `-a` to "update." Combined as `-am`, you get both in one command, for the common case of "commit all my tracked-file edits with this message."

**Q: Why is it dangerous to `git commit --amend` or rebase a commit that's already been pushed?**
A: Amending/rebasing creates new commit objects with new SHAs and moves your local branch to point at them; the old commits are discarded from your branch (though still around until garbage collected). If anyone else already pulled the old commits, their local history now diverges from yours at that point — pushing your rewritten history requires a force-push, which can silently overwrite or orphan their work unless everyone carefully re-syncs. The rule of thumb is: only rewrite commits that exist solely in your local, unshared branch.

**Q: What makes a good commit message, and why does it matter beyond style?**
A: A short (~50 char) imperative-mood summary line ("Add," "Fix," "Refactor," not "Added"/"Fixes"), optionally followed by a blank line and a body explaining *why* the change was made (motivation, tradeoffs) rather than restating the diff. It matters because `git log`, `git blame`, and `git bisect` are only as useful as the messages attached to the commits they surface — a team debugging a regression six months later is relying entirely on past commit messages to reconstruct intent.

## Related Topics

- [branches.md](./branches.md)
- [staging-area.md](./staging-area.md)
- [reset-revert-restore.md](./reset-revert-restore.md)
- [merge-vs-rebase.md](./merge-vs-rebase.md)
- [reflog.md](./reflog.md)
