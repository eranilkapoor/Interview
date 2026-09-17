# Conflict Resolution

A merge conflict happens when Git can't automatically reconcile changes from two sides — a merge, rebase, cherry-pick, or stash pop — because both sides changed the same region of a file (or one side edited a file the other deleted) in ways Git's three-way merge algorithm can't unambiguously combine. Git's default merge strategy compares the common ancestor version of a file against both sides' versions; if only one side changed a given region, Git takes that side's version automatically. A conflict is specifically the case where *both* sides changed the same lines differently (or overlapping regions) — Git can't guess which change should "win," so it stops and asks you to decide.

When a conflict occurs, Git does not fail silently or roll back — it pauses the operation mid-way, writes both versions directly into the affected file(s) using conflict markers, and leaves the repository in a special in-progress state (mid-merge, mid-rebase, etc.) until you resolve it. The markers look like:

```
<<<<<<< HEAD
your current branch's version of this section
=======
the incoming branch's version of this section
>>>>>>> feature-branch
```

Everything between `<<<<<<< HEAD` and `=======` is your side; everything between `=======` and `>>>>>>> <branch>` is the incoming side. Resolving means editing the file down to what it *should* actually contain — which might be one side, the other, a hand-merged combination of both, or something new entirely — and removing all three marker lines in the process.

`git status` during a conflicted state is your map: it explicitly lists files as "both modified" (or "deleted by us"/"deleted by them" for delete/modify conflicts) under an "Unmerged paths" section, distinguishing them from ordinary staged/unstaged changes. Once you've hand-edited a file to resolve its conflict, `git add <file>` marks it as resolved (Git doesn't verify the markers are gone — it trusts you) — repeat for every conflicted file, then run `git commit` (for a merge) or `git rebase --continue` (for a rebase) or `git cherry-pick --continue` to finish the operation. `git mergetool` launches a configured three-way visual diff/merge tool (e.g., VS Code, Meld, `vimdiff`, `kdiff3`) as an alternative to editing markers by hand, showing "ours," "theirs," and the merged result side by side.

## Examples

```bash
# A conflicting merge: both branches edited the same line of the same file
git checkout main
git merge feature/pricing
# Auto-merging src/pricing.ts
# CONFLICT (content): Merge conflict in src/pricing.ts
# Automatic merge failed; fix conflicts and then commit the result.

git status
# Unmerged paths:
#   both modified:   src/pricing.ts
```

```bash
# Resolve by hand: open the file, find the markers, edit down to final content
cat src/pricing.ts
# <<<<<<< HEAD
# const TAX_RATE = 0.08;
# =======
# const TAX_RATE = 0.0825;
# >>>>>>> feature/pricing

# After editing to keep the correct rate and removing all marker lines:
git add src/pricing.ts
git status
# All conflicts fixed but you are still merging.
git commit           # no -m needed; Git pre-fills a "Merge branch..." message
```

```bash
# Use a configured merge tool instead of hand-editing markers
git mergetool
# Launches the configured 3-way diff tool per conflicted file

# Bail out of the whole operation and return to the pre-merge/pre-rebase state
git merge --abort
git rebase --abort
```

## Common Pitfalls / Gotchas

- Leaving stray conflict marker lines (`<<<<<<<`, `=======`, `>>>>>>>`) in the file after "resolving" — this compiles/parses as garbage in many languages and is a classic careless mistake caught in code review.
- Running `git add` on a conflicted file just to make the "unmerged" warning go away without actually reading and resolving the conflicting content — this silently picks whatever the file happened to contain after the failed auto-merge.
- Resolving a conflict by mechanically picking "our" or "their" side everywhere without understanding what the other side's change was *for* — sometimes both changes need to coexist, not just one replace the other.
- Not re-running tests after resolving conflicts — a textually clean resolution can still be semantically wrong if two features touched related logic in ways that don't literally overlap.
- Forgetting you're mid-merge/mid-rebase and trying to switch branches or run unrelated commands — Git will generally block branch switches with uncommitted conflict state, but it's easy to get confused about what state the repo is in without checking `git status` first.

## Interview Questions & Answers

**Q: What causes a merge conflict, mechanically?**
A: Git's three-way merge compares the common ancestor of a file against both sides being merged. If only one side changed a given region, Git applies that change automatically. A conflict occurs specifically when both sides changed the same or overlapping lines differently — Git has no way to determine which change is correct, so it stops and marks the region for manual resolution instead of guessing.

**Q: Walk through how you'd resolve a merge conflict from start to finish.**
A: Run `git status` to see which files are unmerged. Open each conflicted file and find the `<<<<<<<`/`=======`/`>>>>>>>` marker blocks; edit the file to the correct final content, removing all marker lines. Run `git add <file>` for each resolved file to mark it as resolved. Once all conflicts are resolved and staged, run `git commit` (for a merge) or `git rebase --continue` (for a rebase) to complete the operation — or `git merge --abort` / `git rebase --abort` if you want to cancel and return to the pre-conflict state instead.

**Q: What do `<<<<<<< HEAD`, `=======`, and `>>>>>>> branch-name` each represent?**
A: `<<<<<<< HEAD` marks the start of your current branch's version of the conflicting section. `=======` separates the two sides. Everything after `=======` up to `>>>>>>> branch-name` is the incoming branch's (or commit's) version of that same section. Resolving means replacing all of that — markers included — with the content the file should actually have.

**Q: What's the difference between resolving a conflict by hand versus using `git mergetool`?**
A: Hand-resolving means directly editing the marker blocks in a text editor. `git mergetool` launches a configured three-way diff/merge tool that shows "ours," "theirs," and often the common ancestor side by side with a visual interface for choosing/combining changes, then writes the resolved result back to the file — useful for complex conflicts where line-by-line marker editing is hard to reason about, though the end result (a resolved file you still `git add`) is the same either way.

**Q: How would you handle a "delete/modify" conflict — one branch deleted a file the other branch modified?**
A: `git status` reports it distinctly (e.g., "deleted by us" or "deleted by them") rather than "both modified." You decide intent: if the modification should be kept, `git add` the modified version to resolve as "keep it"; if the deletion should win, `git rm` the file to resolve as "remove it." Either way you need an explicit `git add` or `git rm` on the path before completing the merge/rebase, since Git won't guess which side's intent (keep vs. delete) is correct.

## Related Topics

- [merge-vs-rebase.md](./merge-vs-rebase.md)
- [cherry-pick.md](./cherry-pick.md)
- [stash.md](./stash.md)
- [staging-area.md](./staging-area.md)
- [reset-revert-restore.md](./reset-revert-restore.md)
