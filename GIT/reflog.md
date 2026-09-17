# Reflog

The reflog ("reference log") is Git's local, private record of every point `HEAD` (and each branch ref) has pointed to over time — every commit, checkout, reset, rebase, merge, and amend leaves an entry. Unlike `git log`, which walks a commit's *parent chain* and only shows commits reachable through ancestry from a given ref, `git reflog` shows a completely different thing: a chronological journal of where your refs have physically *been*, regardless of whether those commits are still reachable through any branch or parent chain today. This distinction is exactly what makes it Git's most important safety net — it's the tool for finding commits that a `reset --hard`, an amend, or a rebase just made "disappear" from normal view.

Every entry in the reflog is timestamped and labeled with the operation that caused the ref to move (`commit`, `checkout`, `reset`, `rebase`, `pull`, `merge`, `cherry-pick`, and more), addressed as `HEAD@{0}` (current position), `HEAD@{1}` (one move ago), and so on, or by relative time (`HEAD@{2.hours.ago}`, `HEAD@{yesterday}`). Crucially, the reflog is **entirely local** — it lives in `.git/logs/` and is never pushed, fetched, or cloned; it only records history for *this* clone of the repository, and different clones/machines have completely independent reflogs.

The classic recovery scenario: you run `git reset --hard HEAD~3`, intending to discard your last commit but fat-fingering the count and wiping out three real commits' worth of work. The commits aren't deleted from the object database immediately — they just become unreachable from any branch. `git reflog` shows the SHA that `HEAD` pointed to right before the reset (labeled with the reset operation), and `git reset --hard <that-sha>` (or `git branch recovery-branch <that-sha>` to be safer) restores exactly that state. This works because Git's garbage collector doesn't immediately delete unreachable objects — they're kept around, protected by the reflog, until the reflog entry itself expires.

That expiry is configurable and matters for how long this safety net lasts: by default, reflog entries for reachable commits expire after 90 days (`gc.reflogExpire`) and entries for commits that are already unreachable from any branch expire after 30 days (`gc.reflogExpireUnreachable`) — after which `git gc` is free to actually delete the underlying objects. In practice this means the reflog is a *time-bounded* safety net, not permanent history — recent mistakes are almost always recoverable, but you shouldn't rely on it as a substitute for real backups or for anything beyond a few months old.

## Examples

```bash
# See everywhere HEAD has pointed recently, most recent first
git reflog
# a1b2c3d (HEAD -> main) HEAD@{0}: reset: moving to HEAD~3
# f7e8d9c HEAD@{1}: commit: Fix pagination bug
# 5c4d3e2 HEAD@{2}: commit: Add loading spinner
# 9f8e7d6 HEAD@{3}: commit: Update README
```

```bash
# Recover from an accidental `git reset --hard` that discarded real commits
git reset --hard HEAD~3        # oops — meant to undo 1 commit, not 3
git reflog
# f7e8d9c HEAD@{1}: commit: Fix pagination bug   <- this is what we want back

# Safer option: create a branch pointing at the "lost" commit instead of
# resetting again, so you can inspect it before committing to anything
git branch recovery f7e8d9c
git log recovery --oneline -3   # confirm it's the right state
git reset --hard f7e8d9c        # or, once confirmed, restore main directly
```

```bash
# A reflog entry per branch too, not just HEAD — useful after a bad rebase
git reflog show feature/login-form
git reset --hard feature/login-form@{2}   # restore that branch to an earlier state

# Inspect reflog expiry settings
git config gc.reflogExpire             # default: 90 days for reachable entries
git config gc.reflogExpireUnreachable  # default: 30 days for unreachable entries
```

## Common Pitfalls / Gotchas

- Assuming the reflog is part of the repository's shareable history — it's purely local, stored in `.git/logs/`, and is never included in `push`, `fetch`, or `clone`; a teammate can't use *your* reflog to recover *their* lost commit.
- Waiting too long to recover a mistake — reflog entries expire (default 90 days for reachable, 30 for unreachable-from-any-branch), after which `git gc` can permanently delete the underlying objects.
- Confusing `git reflog` with `git log` — `git log` only shows commits reachable via ancestry from a ref right now; `git reflog` shows where the ref itself has been, including states that are no longer reachable by ancestry at all.
- Running another destructive command (like a second `reset --hard`) while trying to "explore" a recovery — every reflog-changing operation adds a new entry, so panicking and issuing more resets/checkouts can bury the entry you actually wanted under newer ones (though it's still there, just further back).
- Not realizing `git gc --aggressive` (or an automatic gc trigger) can prune reflog-expired unreachable objects — reflog is a safety net with an expiration date, not a permanent undo history.

## Interview Questions & Answers

**Q: What is the reflog, and how is it different from `git log`?**
A: The reflog is a local, chronological record of every position `HEAD` and each branch ref has pointed to, recorded on every commit/checkout/reset/rebase/merge operation. `git log` walks a commit's ancestry (parent pointers) from a given ref and only shows commits still reachable that way. The reflog instead shows literal ref movement over time, including entries pointing at commits that are no longer reachable via any branch's ancestry — which is exactly why it can recover "lost" commits that `git log` can no longer see at all.

**Q: Walk through recovering a commit after an accidental `git reset --hard`.**
A: Run `git reflog` to see the sequence of HEAD positions, including the SHA it pointed to right before the reset (each entry is labeled with the operation, e.g., "reset: moving to..."). Identify the SHA you want back, then either `git reset --hard <sha>` to move your branch back to it directly, or — more cautiously — `git branch recovery <sha>` to create a new branch pointing at it first so you can inspect and confirm before touching your main branch's pointer.

**Q: Is the reflog shared when you push or clone a repository?**
A: No. The reflog is purely local, stored under `.git/logs/`, and reflects only what has happened in *this* particular local clone/repository. It's never transmitted by `push`, `fetch`, `pull`, or `clone` — every clone of a repository has its own independent reflog starting fresh from when it was created.

**Q: Why doesn't Git immediately delete commits that become unreachable, e.g., after a reset or rebase?**
A: Because the reflog holds a reference to them, and Git's garbage collector treats reflog entries as keeping their target objects alive, not just objects reachable from current branches/tags. Objects only become eligible for actual deletion once their reflog entry expires (default 90 days for entries that were reachable, 30 days for entries already unreachable when recorded) and `git gc` subsequently runs.

**Q: Give a real scenario where the reflog would save you but `git log` alone would not.**
A: After an interactive rebase that squashed/reordered commits incorrectly, or an `--amend` that accidentally discarded work, `git log` on your branch only shows the *current* resulting history — the discarded original commits aren't reachable from any branch anymore, so they simply don't appear. `git reflog` still shows the SHA your branch pointed to right before the rebase/amend, letting you `git reset --hard` back to that exact pre-operation state even though it's invisible to `git log`.

## Related Topics

- [reset-revert-restore.md](./reset-revert-restore.md)
- [merge-vs-rebase.md](./merge-vs-rebase.md)
- [branches.md](./branches.md)
- [commits.md](./commits.md)
