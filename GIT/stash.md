# Stash

`git stash` solves a very specific, very common problem: you have uncommitted changes in your working directory (and possibly the index) that you're not ready to commit, but you need a clean working directory *right now* — to switch branches, pull in urgent upstream changes, or context-switch to a hotfix. Committing half-finished work just to switch away is messy; discarding it loses real progress. Stash takes a snapshot of your current uncommitted changes, stores it away on a separate stack, and resets your working directory back to match HEAD — giving you a clean slate while keeping the work safe and recoverable.

`git stash push` (or bare `git stash`, which defaults to the same behavior) is the save operation — it stashes both staged and unstaged changes to tracked files by default (untracked and ignored files are excluded unless you pass `-u`/`--include-untracked` or `-a`/`--all`). Each stash is pushed onto a stack, referenced as `stash@{0}` (most recent), `stash@{1}`, and so on — you can accumulate multiple independent stashes before ever popping any of them, which is genuinely useful when juggling several unrelated interruptions.

`git stash pop` applies the most recent stash's changes back onto your current working directory *and* removes it from the stash stack in one step — the common case when you're returning to exactly where you left off. `git stash apply` does the same reapplication but *without* removing the entry from the stack, useful when you want to apply the same stashed changes to multiple branches, or want a safety net in case the apply doesn't go cleanly. `git stash list` shows everything currently stashed, `git stash show -p stash@{1}` shows a specific stash's actual diff, and `git stash drop stash@{1}` discards one entry without applying it.

Because a stash pop/apply is really just Git attempting to merge the stashed changes back into your current working directory state, it can conflict — exactly like a merge — if the working directory has diverged from what it looked like when the stash was created (e.g., you switched branches, pulled new commits, or someone else's changes now touch the same lines). Git resolves as much as it can automatically and leaves conflict markers for the rest, same workflow as any merge conflict; critically, on a conflicted pop, Git does **not** automatically drop the stash entry from the stack (unlike a clean pop) — you must resolve conflicts and `git stash drop` manually afterward, to avoid silently losing the stashed state if something went wrong. `git stash push -- <path>` lets you stash only specific files rather than everything in the working directory, useful when you have multiple unrelated in-progress changes and only want to shelve some of them.

## Examples

```bash
# Save uncommitted work to switch branches for an urgent fix, then come back
git stash push -m "WIP: refactor pagination logic"
git status                       # clean working directory
git checkout main
# ...handle the urgent thing, commit, push...
git checkout feature/pagination
git stash pop                    # restores the stashed changes, removes from stack
```

```bash
# Multiple stashes, listing and inspecting them
git stash push -m "Unfinished form validation"
git stash push -m "Debug logging I don't want to commit yet"
git stash list
# stash@{0}: On feature/x: Debug logging I don't want to commit yet
# stash@{1}: On feature/x: Unfinished form validation

git stash show -p stash@{1}      # see the actual diff without applying it
git stash apply stash@{1}        # apply without removing from the stack
git stash drop stash@{1}         # now discard it once no longer needed
```

```bash
# Stash only specific files, and include untracked files when needed
git stash push -- src/utils/date.ts     # stash just this one file's changes
git stash push -u -m "everything, including new untracked files"

# Handling a conflict on pop: Git leaves the stash entry on the stack
git stash pop
# CONFLICT (content): Merge conflict in src/app.ts
# ...resolve conflict markers, git add...
git stash drop                   # manually drop it once you've confirmed the resolution is correct
```

## Common Pitfalls / Gotchas

- Forgetting that `git stash` (no flags) does **not** include untracked or ignored files by default — new files silently stay in the working directory, unaffected, unless you pass `-u`/`--include-untracked`.
- Accumulating many stashes over weeks without labeling them (`-m "..."`) — `git stash list` with generic auto-generated messages becomes impossible to navigate later.
- Assuming `git stash pop` always cleanly removes the entry — on a conflicted pop, Git leaves the stash on the stack deliberately (as a safety net), and forgetting to `git stash drop` afterward leaves a stale, already-applied entry cluttering the stack.
- Popping a stash onto a working directory that has diverged significantly from where the stash was created (different branch, new commits) and being surprised by conflicts — stash reapplication is a merge, not a magic restore.
- Using stash as a long-term storage mechanism for work in progress instead of committing to a branch — stashes are easy to lose track of, aren't pushed to remotes, and don't show up in normal history/log views.

## Interview Questions & Answers

**Q: What does `git stash` actually do, mechanically?**
A: It records the current state of the index and working directory as a special commit-like object (technically stored as commits on an internal `refs/stash` ref, not shown in normal branch history), pushes a reference to it onto a stack (`stash@{0}`, `stash@{1}`, ...), and then resets the working directory and index back to match HEAD — leaving you with a clean working directory while your in-progress changes are safely recorded elsewhere.

**Q: What's the difference between `git stash pop` and `git stash apply`?**
A: Both reapply a stashed change set onto your current working directory. `pop` additionally removes that entry from the stash stack afterward — the common "I'm done with this stash" case. `apply` leaves the entry on the stack after reapplying it, useful if you want to apply the same stashed changes to more than one branch, or want to keep it as a fallback in case the reapplication turns out to have problems you need to redo from scratch.

**Q: Does `git stash` include new, untracked files by default?**
A: No. By default, `git stash` (or `git stash push`) only stashes changes to files Git already tracks — modified and staged content. Untracked files (and ignored files) are left completely alone in the working directory unless you explicitly pass `-u`/`--include-untracked` (untracked only) or `-a`/`--all` (untracked and ignored both).

**Q: What happens if `git stash pop` results in a conflict?**
A: Git attempts to merge the stashed changes into your current working directory state, and if that merge has conflicts, it behaves like any merge conflict — conflict markers are left in the affected files, and you resolve them manually and `git add` the results. The key difference from a clean pop: Git deliberately does **not** remove the stash entry from the stack automatically in this case, so you don't lose the stashed state if the resolution goes wrong; you must run `git stash drop` yourself once you're confident the conflict was resolved correctly.

**Q: How would you stash only some of your changes, not everything in the working directory?**
A: `git stash push -- <path>` stashes changes to only the specified path(s), leaving other modified files in the working directory untouched. For finer-grained control within a single file, `git stash push -p` walks through hunks interactively (like `git add -p`), letting you choose exactly which changes go into the stash and which stay in the working directory.

## Related Topics

- [staging-area.md](./staging-area.md)
- [conflict-resolution.md](./conflict-resolution.md)
- [reset-revert-restore.md](./reset-revert-restore.md)
- [branches.md](./branches.md)
