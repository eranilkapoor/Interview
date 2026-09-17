# Reset, Revert, and Restore

These three commands are Git's main "undo" tools, and interview candidates who can crisply distinguish them stand out — because they solve overlapping but genuinely different problems, and mixing them up on a shared branch can cause real damage. The core distinction: `git reset` and `git restore` rewrite/move things *locally* (safe on unpushed work, dangerous on shared history), while `git revert` creates *new*, additive history that's safe to use even on a branch others have already pulled.

`git reset` moves the current branch pointer to a different commit, and — depending on the flag — optionally rewinds the index and/or working directory to match. `--soft` moves only the branch pointer; the index and working directory are left untouched, so everything from the "undone" commits reappears as staged changes, ready to be recommitted differently. `--mixed` (the default if no flag is given) moves the branch pointer *and* resets the index to match the new HEAD, but leaves the working directory alone — so those changes become unstaged modifications instead. `--hard` moves the branch pointer, resets the index, **and** overwrites the working directory to match — this is the genuinely destructive one, since any uncommitted changes in the working directory matching those files are simply gone (not stashed, not staged — discarded), though the commits themselves may still be recoverable briefly via `git reflog` if they existed before the reset.

`git revert <commit>` takes the opposite philosophy entirely: instead of moving pointers or discarding commits, it creates a **brand-new commit** whose diff is the exact inverse of the target commit's diff, applied on top of current history. The original commit stays in history untouched; the revert commit sits after it, undoing its effect. This makes revert the only one of the three that's safe on a shared/pushed branch — nothing is rewritten or removed, so nobody else's history is invalidated; it's simply "add one more commit that cancels out an earlier one."

`git restore` is the newest of the three (Git 2.23+), introduced specifically to split apart `checkout`'s overloaded, confusing responsibilities (switching branches vs. restoring files). `git restore <file>` discards uncommitted working-directory changes to that file, replacing it with the version from the index (or, with `--source`, from any specific commit). `git restore --staged <file>` does the "unstage" operation — moves a file's staged changes back to unstaged without touching the working directory content at all, the same effect `git reset HEAD <file>` used to be the (less obvious) way to achieve.

## Examples

```bash
# --soft: undo the last commit but keep everything staged, ready to recommit
git reset --soft HEAD~1
git status
# Changes to be committed: ...   <- last commit's changes are now staged again

# --mixed (default): undo the commit AND unstage, but keep the file edits
git reset HEAD~1              # same as: git reset --mixed HEAD~1
git status
# Changes not staged for commit: ...

# --hard: undo the commit and discard the file changes entirely (destructive)
git reset --hard HEAD~1       # working directory now matches HEAD~1 exactly
```

```bash
# revert: safe undo for a commit that's already been pushed/shared
git revert a1b2c3d
# Creates a NEW commit whose diff exactly cancels a1b2c3d's changes.
# The original commit a1b2c3d remains in history untouched.
git log --oneline -3
# 9f8e7d6 Revert "Add experimental caching layer"
# a1b2c3d Add experimental caching layer
# 5c4d3e2 Update README
```

```bash
# restore: working-tree and staging-area undo, without touching commit history
git restore src/app.ts             # discard uncommitted edits, back to last-staged/HEAD version
git restore --staged src/app.ts    # unstage src/app.ts, keep the edits in the working directory
git restore --source=HEAD~3 src/app.ts   # restore the file's content from 3 commits ago
```

## Common Pitfalls / Gotchas

- Running `git reset --hard` without realizing uncommitted working-directory changes are discarded permanently (not stashed) — always `git status` first, and `git stash` anything you might need before a hard reset.
- Using `git reset` (which rewrites the branch pointer, discarding commits from the branch) on a commit that's already been pushed and pulled by others — exactly the same "never rewrite shared history" problem as rebase, since a subsequent push requires `--force`.
- Confusing `git revert`'s safety with `git reset`'s — reverting is the correct choice specifically *because* it doesn't rewrite history, making it the right tool once a bad commit is already shared/public.
- Forgetting that `git restore <file>` (no `--staged`) discards working-directory changes to that file with no confirmation and no easy built-in undo (barring reflog tricks that don't really apply to uncommitted working-tree content).
- Using the old, ambiguous `git checkout -- <file>` / `git checkout <commit> -- <file>` out of habit — functionally similar to `git restore` in many cases, but `checkout`'s overload with branch-switching makes it easy to typo your way into an unintended branch switch instead.

## Interview Questions & Answers

**Q: Explain the difference between `git reset --soft`, `--mixed`, and `--hard`.**
A: All three move the current branch pointer to a different commit. `--soft` stops there — the index and working directory are untouched, so the "undone" commits' changes reappear as staged changes. `--mixed` (the default) also resets the index to match the new HEAD, so those changes become unstaged (but still present) working-directory modifications. `--hard` additionally overwrites the working directory to match the new HEAD, discarding any uncommitted changes in tracked files entirely — the only one of the three that can lose uncommitted work.

**Q: Why is `git revert` considered safer than `git reset` for undoing a commit that's already been pushed?**
A: `git revert` doesn't rewrite or remove any existing commit — it adds a brand-new commit whose diff cancels out the target commit's changes, so history only grows, it never gets rewritten. `git reset` moves the branch pointer backward, effectively removing commits from that branch's history; if those commits were already pushed and others have pulled them, resetting and force-pushing invalidates their history too, exactly like a disallowed rebase on shared history.

**Q: What does `git restore --staged <file>` do, and how does it differ from plain `git restore <file>`?**
A: `git restore --staged <file>` moves that file's changes from the index back to unstaged, without touching its content in the working directory at all — a clean "undo `git add`." Plain `git restore <file>` (no `--staged`) does the opposite kind of operation: it discards uncommitted changes in the working directory, replacing the file's content with what's currently in the index (or HEAD, if nothing's staged) — a genuine, content-losing discard of edits.

**Q: Give a scenario where `git reset --soft` is exactly the right tool.**
A: You made three small commits locally that you haven't pushed yet, and you want to squash them into one clean commit before pushing/opening a PR. `git reset --soft HEAD~3` moves the branch pointer back three commits while leaving all their combined changes staged and ready — then a single `git commit -m "..."` creates one clean commit containing everything, without you having to manually restage anything.

**Q: If you accidentally run `git reset --hard` and lose uncommitted work, is it recoverable?**
A: Only partially, and only sometimes. `git reflog` can recover commits that existed before the reset (since the reset just moves the branch pointer, and the reflog remembers where it pointed before). But truly *uncommitted* working-directory changes at the time of the hard reset are not tracked by any Git object at all — they were never committed or stashed — so they are generally not recoverable through Git; this is exactly why checking `git status` and stashing first matters before running a hard reset.

## Related Topics

- [commits.md](./commits.md)
- [reflog.md](./reflog.md)
- [staging-area.md](./staging-area.md)
- [stash.md](./stash.md)
- [merge-vs-rebase.md](./merge-vs-rebase.md)
