# Merge vs Rebase

`git merge` and `git rebase` solve the same underlying problem — integrating changes from one branch into another — but they produce fundamentally different history shapes, and the choice between them is one of the most common real-world Git decisions a team codifies into policy. `git merge <branch>` takes the tip of your current branch and the tip of the branch being merged in, finds their common ancestor, and creates a brand-new **merge commit** with *two* parents (the current tip and the merged-in tip). Nothing about existing commits changes — merge is purely additive, which is why it's often called "non-destructive." The resulting history shows exactly when and how branches diverged and came back together, preserved as a literal graph shape.

`git rebase <branch>` takes a completely different approach: it replays your current branch's commits, one at a time, on top of the target branch's tip, generating a *new* commit for each of your original commits (same diff and message, but new parent, new SHA, new timestamp). The result is a straight, linear history with no merge commit at all — it looks as if you had written your commits starting from the target branch's latest state all along. This linearity is rebase's main selling point: a clean, readable, bisectable history without merge-commit noise. The cost is that it's a form of history rewriting — the original commits are discarded in favor of new ones with different SHAs.

This is exactly where the cardinal rule comes from: **never rebase commits that have already been pushed and that others may have pulled or based work on.** Since rebase creates new commits with new SHAs, anyone who already has the old commits now has a history that has diverged from yours at the point of rebase; reconciling that requires either a forced re-sync on their end or a messy, duplicate-commit merge. Rebasing is safe — and genuinely useful — for local, not-yet-shared branches, e.g., cleaning up a feature branch (squashing "wip" commits, catching it up to the latest `main`) before opening a pull request.

In practice, most teams pick a default by context: rebase (or squash) feature branches onto `main` before opening a PR to keep the eventual history linear and readable, but use a genuine merge commit (often via the PR "merge" button) to actually integrate the reviewed branch into `main`, since that merge commit is shared/public the moment it exists and a merge is the safe, non-destructive way to record that integration point. `git pull --rebase` is another common application: instead of merging remote changes into your local branch (creating a merge commit every time you pull while you have local unpushed commits), it replays your local commits on top of the fetched remote tip, keeping history linear without you doing anything manual.

## Examples

```bash
# Merge: integrates feature into main with a two-parent merge commit
git checkout main
git merge feature/login-form
# On success: "Merge made by the 'ort' strategy." — a new merge commit is created
# unless the merge is a simple fast-forward (feature was already ahead of main
# with no divergent commits on main), in which case main's pointer just moves.
git log --oneline --graph -5
#   *   a1b2c3d Merge branch 'feature/login-form'
#   |\
#   | * 9f8e7d6 Add form validation
#   * | 5c4d3e2 Update README
#   |/
#   * 1a2b3c4 Initial commit
```

```bash
# Rebase: replays feature's commits on top of main's current tip, no merge commit
git checkout feature/login-form
git rebase main
# If conflicts occur, Git pauses mid-replay:
#   git status              # shows the conflicting files
#   # ...edit to resolve conflict markers...
#   git add resolved-file.ts
#   git rebase --continue   # or `git rebase --abort` to bail out entirely
git log --oneline --graph -5
#   * 7d6c5b4 Add form validation      <- new SHA, replayed on top of main
#   * 5c4d3e2 Update README            <- main's tip
#   * 1a2b3c4 Initial commit
```

```bash
# Common real workflow: rebase your local feature branch to catch up on main,
# then merge (or let a PR "squash and merge") it back cleanly
git fetch origin
git rebase origin/main          # only safe because this branch is still local/unshared
git push --force-with-lease     # required after rebase rewrites already-pushed commits
                                 # --force-with-lease refuses if the remote moved since your last fetch
```

## Common Pitfalls / Gotchas

- Rebasing a branch that others have already pulled or built work on top of — it rewrites SHAs, silently orphaning anyone else's history that was based on the old commits.
- Using plain `git push --force` after a rebase instead of `--force-with-lease`, which can overwrite a teammate's work that was pushed to the same branch after your last fetch.
- Resolving the same conflict repeatedly during a long rebase, since rebase replays commits one at a time and the same lines may conflict on multiple commits in sequence — `git rebase --continue` after each resolution, and consider `git rerere` to auto-reapply previous resolutions.
- Assuming rebase "loses" your original commits permanently — the old commits still exist in the object database and are recoverable via `git reflog` for a while, since rebase creates new commits rather than deleting the old ones outright.
- Choosing merge or rebase inconsistently across a team without an agreed convention, producing a history that's neither cleanly linear nor clearly showing integration points.

## Interview Questions & Answers

**Q: What's the fundamental difference between merge and rebase?**
A: Merge creates a new commit with two parents that joins two histories together — the original commits on both branches are untouched, and the branch/merge structure is preserved visually in the log. Rebase replays your branch's commits one by one on top of another branch's tip, generating brand-new commits (new SHAs) for each — the result is a linear history with no merge commit, but the original commits are effectively replaced.

**Q: Why is it dangerous to rebase commits that have already been pushed?**
A: Rebase discards the original commits and creates new ones with different SHAs, even though the content/diffs are the same. If anyone else has already pulled the original commits, their local history now references commits that no longer exist on your rewritten branch — pushing the rebase forces a divergence that requires a force-push and manual reconciliation on their end, risking lost or duplicated work.

**Q: When would you choose rebase over merge, and vice versa?**
A: Rebase a local, not-yet-shared feature branch to clean up messy commits or catch it up to the latest `main` before opening a PR — it produces a clean, linear, easy-to-bisect history. Use a real merge (not rebase) to integrate a reviewed, already-public branch into `main`, since a merge commit is non-destructive and safely records the integration point without rewriting anything anyone else already has.

**Q: What is a fast-forward merge, and when does it happen instead of creating a merge commit?**
A: A fast-forward happens when the branch being merged into has had no new commits since the two branches diverged — i.e., the target branch's tip is a direct ancestor of the branch being merged in. In that case, Git doesn't need to create a merge commit at all; it just moves the target branch's pointer forward to match the other branch's tip, since there's nothing to reconcile.

**Q: How do you handle conflicts during a rebase, and how is that different from a merge conflict?**
A: During `git rebase`, Git replays commits one at a time; if a commit's changes conflict with the current state, it pauses on *that* commit specifically — you resolve the conflict markers, `git add` the resolved files, and run `git rebase --continue` to proceed to the next commit (or `--abort` to cancel the whole rebase and return to the pre-rebase state). This differs from a merge conflict, which happens once, in one combined step, comparing the two branch tips directly rather than commit by commit.

## Related Topics

- [branches.md](./branches.md)
- [conflict-resolution.md](./conflict-resolution.md)
- [reflog.md](./reflog.md)
- [cherry-pick.md](./cherry-pick.md)
- [remote-repositories.md](./remote-repositories.md)
