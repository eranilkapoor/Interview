# Staging Area

The staging area — also called the **index** — is a binary file at `.git/index` that holds a snapshot-in-progress of what will become your next commit. It sits conceptually between the working tree (your actual files) and HEAD (the last commit). When you run `git commit`, Git doesn't ask "what changed in my files?" — it simply takes whatever is currently recorded in the index and turns it into a new commit object. This is what lets you build a commit incrementally: stage a few related changes, review them, stage a few more, and only then commit, all without touching files you're not ready to include.

The single most important — and most misunderstood — fact about `git add` is that it stages the **content of a file at the exact moment you run it**, not an ongoing reference to "the file" as a whole. If you `git add file.js`, then edit `file.js` again before committing, those new edits are sitting only in the working tree; the index still holds the earlier version. `git status` will even show `file.js` in both the "staged" and "not staged" sections simultaneously, because two different versions of it exist in two different places at once.

Because the index is just a snapshot, you can inspect it directly: `git diff` (no flags) compares the working tree against the index, showing what you *haven't* staged yet. `git diff --staged` (equivalently `--cached`) compares the index against HEAD, showing exactly what the next commit will contain. These are genuinely different diffs, and conflating them is a common source of confusion when reviewing your own changes before committing.

## Examples

```bash
# Stage a specific file, then check the two different diffs
git add file.js
git diff            # empty for file.js — index matches working tree
git diff --staged   # shows file.js's changes — index differs from HEAD
```

```bash
# Interactive staging: pick specific hunks within a file
git add -p file.js
# Git walks each hunk and asks y/n/s(plit)/e(dit)/q(uit) per hunk,
# letting you stage part of a file's changes while leaving the rest unstaged.
```

```bash
# Unstage a file without discarding your edits
git restore --staged file.js
# file.js's changes move back to "not staged" — working tree content is untouched

# Older equivalent (pre Git 2.23):
git reset HEAD file.js
```

## Common Pitfalls / Gotchas

- Editing a file again *after* `git add`-ing it means the new edits are not staged. Running `git commit` at that point commits only the version you staged earlier — you must `git add` again to include the newer edits.
- `git commit -a` auto-stages modifications and deletions to files Git *already tracks*, bypassing a manual `git add` step — but it will never pick up brand-new untracked files, since there's nothing in the index to "update" for a file Git doesn't know about yet.
- `git add .` (or `git add -A`) stages deletions too, not just new/modified content — if you deleted files in the working tree, they'll be staged for removal from the next commit as well.
- Assuming `git diff` shows "your changes" in general — it only shows working-tree-vs-index. If everything is staged, `git diff` will show nothing at all, and you need `git diff --staged` to see what's actually about to be committed.

## Interview Questions & Answers

**Q: What is the index/staging area, technically?**
A: A binary file at `.git/index` that records a snapshot of blob SHAs and file paths representing the exact content that will be used to build the next commit's tree object. It's updated by `git add`, `git rm`, `git mv`, and reset by commands like `git restore --staged`.

**Q: What's the difference between `git diff` and `git diff --staged`?**
A: `git diff` compares the working tree to the index (unstaged changes — what you'd lose if you discarded working-tree edits). `git diff --staged` (or `--cached`) compares the index to HEAD (staged changes — exactly what the next `git commit` will record).

**Q: How do you unstage a file without losing your edits?**
A: `git restore --staged <file>` moves the file's staged changes back to unstaged, leaving the working tree content exactly as it was. The edits aren't lost — they simply stop being tracked by the index for the next commit.

**Q: Why doesn't `git commit -a` pick up newly created files?**
A: `-a` tells Git to stage changes for files it is already tracking (modifications and deletions) before committing, as a shortcut for `git add` on known files. A new file has no entry in the index or HEAD at all, so there's nothing for `-a` to "update" — Git has no tracking relationship with it until you explicitly `git add` it at least once.

## Related Topics

- [repository-and-working-tree.md](./repository-and-working-tree.md)
- [commits.md](./commits.md)
- [reset-revert-restore.md](./reset-revert-restore.md)
