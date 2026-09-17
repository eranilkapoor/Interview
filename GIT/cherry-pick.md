# Cherry Pick

`git cherry-pick <commit-sha>` takes the exact changes introduced by one specific commit on some branch and applies them as a new commit on your *current* branch — without merging or rebasing the rest of that branch's history. It's the tool for "I want *that one fix*, not the whole branch." Internally, Git computes the diff that commit introduced relative to its own parent, then applies that diff to your current working tree/HEAD and creates a brand-new commit with the same message and author information as the original, but a new SHA, a new parent, and a new commit date (author date is preserved, committer date is not, unless you pass extra flags).

The most common real-world use case is a hotfix: a bug is fixed on `main`, and that exact fix also needs to land on a `release/2.3` branch (or several maintained release branches) without pulling in every other unrelated commit that's landed on `main` since the branches diverged. Rather than merging all of `main` into the release branch, you cherry-pick just the one (or few) commits that contain the fix.

Because cherry-pick applies a diff against your current state rather than replaying with full context of the original branch, conflicts are common if the surrounding code has diverged between the source and target — you resolve them exactly like a merge conflict: edit the conflict markers, `git add` the resolved files, then `git cherry-pick --continue` (or `--abort` to cancel, or `--skip` to drop just that commit and move to the next one, if cherry-picking a range). The `-x` flag appends a line to the new commit's message ("(cherry picked from commit `<sha>`)"), which is valuable for traceability — it lets anyone reading `git log` on the target branch see exactly which original commit this change came from, useful when auditing which fixes have or haven't been backported.

Cherry-pick can also take a range or multiple individual commits (`git cherry-pick A B C` or `git cherry-pick A^..C` for a contiguous range), applying each in order and creating one new commit per original commit. It's worth explicitly distinguishing from rebase: rebase replays an *entire* branch's worth of commits onto a new base as part of restructuring that branch's own history; cherry-pick copies a *deliberately selected subset* of commits from one branch onto a different, unrelated branch, leaving the source branch and its history completely untouched.

## Examples

```bash
# Backport a single hotfix commit from main onto a release branch
git checkout release/2.3
git cherry-pick a1b2c3d
# Creates a new commit on release/2.3 with the same diff/message as a1b2c3d
```

```bash
# Cherry-pick with traceability: records where the commit originally came from
git cherry-pick -x a1b2c3d
git log -1
# commit 7f6e5d4...
#     Fix null pointer in session handler
#
#     (cherry picked from commit a1b2c3d9e8f7...)
```

```bash
# Cherry-pick a contiguous range of commits, and handle a conflict mid-range
git cherry-pick a1b2c3d^..f7e8d9c   # applies every commit from a1b2c3d through f7e8d9c
# CONFLICT (content): Merge conflict in src/session.ts
git status                           # shows the conflicting file
# ...resolve conflict markers in src/session.ts...
git add src/session.ts
git cherry-pick --continue           # applies this commit, moves to the next in the range
# or: git cherry-pick --skip         # drop this one commit, continue with the rest
# or: git cherry-pick --abort        # cancel entirely, return to pre-cherry-pick state
```

## Common Pitfalls / Gotchas

- Cherry-picking a commit that depends on earlier commits not yet present on the target branch — the diff may apply with unexpected conflicts, or apply "cleanly" but be semantically broken because prerequisite code is missing.
- Forgetting `-x`, making it hard to later audit which fixes have been backported to which release branches, especially across many cherry-picks over time.
- Cherry-picking a merge commit without `-m <parent-number>` to specify which parent's diff to use — Git refuses a plain cherry-pick of a merge commit because it's ambiguous which side's changes you actually want.
- Using cherry-pick as a substitute for a real merge/rebase when integrating an entire branch — cherry-picking every commit one by one loses the branch structure and creates entirely new SHAs for commits that already existed elsewhere, duplicating history.
- Not testing after a cherry-pick "succeeds" with no conflicts — a clean apply doesn't guarantee the change is semantically correct in the new context; the surrounding code may have diverged in ways that don't trigger a textual conflict but do break behavior.

## Interview Questions & Answers

**Q: What does `git cherry-pick` actually do, mechanically?**
A: It computes the diff a specific commit introduced relative to its own parent, applies that diff to your current branch's working tree, and creates a new commit with the same message/author but a new SHA and a new parent (your current HEAD). It's essentially "copy this one change onto wherever I am now," independent of the rest of that commit's original branch history.

**Q: When would you use cherry-pick instead of merge or rebase?**
A: When you need one specific commit's changes on a different branch without bringing in the rest of that branch's history — the classic case is backporting a hotfix from `main` to an older `release/x.y` branch. Merge/rebase are for integrating or replaying an entire branch's worth of commits; cherry-pick is for surgically selecting a subset.

**Q: What does the `-x` flag do, and why is it useful?**
A: It appends a `(cherry picked from commit <sha>)` line to the new commit's message, recording where the change originally came from. It's useful for traceability — especially with multiple long-lived release branches — so anyone reading history later can tell which fixes have already been backported where without cross-referencing manually.

**Q: How do you handle a conflict during cherry-pick, and how is it similar to a merge conflict?**
A: Git pauses and leaves the file with standard conflict markers, exactly like a merge conflict. You edit the file to resolve it, `git add` the resolved file(s), then run `git cherry-pick --continue`. If you're cherry-picking a range, `--continue` moves on to the next commit in the range; `--skip` drops just the current commit and continues; `--abort` cancels the whole operation and restores the pre-cherry-pick state.

**Q: What's the risk of cherry-picking many individual commits instead of merging a branch?**
A: Each cherry-picked commit gets a brand-new SHA, distinct from the original — so if that same branch is later merged normally, Git doesn't recognize the cherry-picked commits as "already applied" purely by content in all cases, which can lead to duplicate commits, redundant diffs, or conflicts during the eventual merge. It also fragments history, since the same logical change now exists as multiple unrelated commit objects across branches.

## Related Topics

- [branches.md](./branches.md)
- [merge-vs-rebase.md](./merge-vs-rebase.md)
- [conflict-resolution.md](./conflict-resolution.md)
- [commits.md](./commits.md)
- [reflog.md](./reflog.md)
