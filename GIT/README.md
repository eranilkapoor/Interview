# Git Interview Preparation

This folder covers Git for technical interviews: how the object model actually works underneath the commands, the everyday local workflow, collaboration through remotes and pull requests, and the recovery/undo tools that separate a confident Git user from someone who only knows a handful of memorized commands. Each file follows the same structure — a real conceptual explanation, runnable command examples, common pitfalls, and interview Q&A — so you can read a topic standalone or work through the whole folder in one pass.

## Table of Contents

### Core Concepts
- [Git Basics](./git-basics.md) — `init`/`clone`/`add`/`commit`/`status`, the three trees
- [Repository and Working Tree](./repository-and-working-tree.md) — what `.git` actually stores, the object model
- [Staging Area](./staging-area.md) — the index, `git add`, `diff` vs `diff --staged`
- [Commits](./commits.md) — snapshots, SHAs, `--amend`, commit message practices

### Branching & Integration
- [Branches](./branches.md) — branches as pointers, HEAD, detached HEAD, branching strategy
- [Merge vs Rebase](./merge-vs-rebase.md) — merge commits vs. linear history, when to use each
- [Cherry Pick](./cherry-pick.md) — applying a single commit to another branch, backporting
- [Conflict Resolution](./conflict-resolution.md) — conflict markers, `git mergetool`, resolving state

### Undo & Recovery
- [Reset, Revert, and Restore](./reset-revert-restore.md) — `--soft`/`--mixed`/`--hard`, safe vs. destructive undo
- [Stash](./stash.md) — shelving uncommitted work, the stash stack
- [Reflog](./reflog.md) — recovering "lost" commits, HEAD's movement history

### Collaboration
- [Remote Repositories](./remote-repositories.md) — `fetch` vs. `pull`, tracking branches, `push`
- [Pull Requests](./pull-requests.md) — review workflow, draft PRs, merge strategies
- [Git Flow](./git-flow.md) — main/develop/feature/release/hotfix vs. trunk-based and GitHub Flow

### Releases
- [Tags](./tags.md) — lightweight vs. annotated tags, semantic versioning

## Interview Questions & Answers — Curated

**Q: What are Git's "three trees," and what does each Git command actually operate on? (Beginner)**
A: The working directory (files on disk), the index/staging area (a snapshot-in-progress of the next commit), and HEAD (the last commit on the current branch). `git add` moves changes from working directory to index; `git commit` moves index to HEAD (as a new commit); `git diff` compares working directory to index; `git diff --staged` compares index to HEAD.

**Q: What is a commit, technically — a diff or a snapshot? (Beginner)**
A: A full snapshot. Each commit points to a tree object representing the complete state of every tracked file, plus a parent pointer and metadata. Git computes diffs on demand by comparing two commits' trees; nothing is stored as an incremental diff on disk.

**Q: What is a branch, technically? (Beginner)**
A: A movable pointer (a small ref file) to a single commit SHA. Creating one is effectively free — it's not a copy of any files — and "the history of a branch" is just whatever commits are reachable by walking parent pointers backward from wherever the pointer currently points.

**Q: What's the difference between `git fetch` and `git pull`? (Beginner)**
A: `fetch` downloads new commits/branches/tags from the remote and updates your local copies of the remote's refs, without touching your working directory or current branch. `pull` does a fetch and then automatically merges (or rebases) the fetched changes into your current branch — it can alter your working directory and create conflicts, which `fetch` alone never does.

**Q: What's the difference between `git merge` and `git rebase`? (Intermediate)**
A: Merge creates a new two-parent commit joining two histories, leaving existing commits untouched and preserving branch structure. Rebase replays your branch's commits one by one onto a new base, creating new commits (new SHAs) and producing a linear history with no merge commit — at the cost of the original commits being discarded/replaced.

**Q: Why should you never rebase commits that have already been pushed and pulled by others? (Intermediate)**
A: Rebase generates new commits with new SHAs even though the content is the same. Anyone who already has the original commits now has history that diverges from yours at the rebase point; reconciling requires a force-push and manual re-sync on their end, risking lost or duplicated work. Rebase is safe only on local, not-yet-shared branches.

**Q: Explain `git reset --soft`, `--mixed`, and `--hard`. (Intermediate)**
A: All three move the branch pointer to a different commit. `--soft` leaves the index and working directory untouched (undone commits' changes become staged). `--mixed` (default) also resets the index, so changes become unstaged but still present. `--hard` additionally overwrites the working directory, discarding uncommitted changes to tracked files entirely — the only one of the three that can lose uncommitted work.

**Q: Why is `git revert` considered safer than `git reset` for undoing a shared commit? (Intermediate)**
A: Revert creates a brand-new commit whose diff cancels the target commit's changes — history only grows, nothing is rewritten. Reset moves the branch pointer backward, effectively removing commits from that branch; doing this to already-pushed/pulled commits requires a force-push and invalidates others' history, the same risk rebase carries.

**Q: What is the reflog, and how does it differ from `git log`? (Intermediate)**
A: The reflog is a local, chronological record of every position HEAD and branch refs have pointed to, recorded on every commit/checkout/reset/rebase. `git log` only shows commits reachable via ancestry from a ref right now. The reflog can show — and let you recover — commits that are no longer reachable that way, e.g., after an accidental `reset --hard`.

**Q: Walk through resolving a merge conflict. (Intermediate)**
A: `git status` shows unmerged files. Open each and find the `<<<<<<<`/`=======`/`>>>>>>>` marker blocks; edit down to the correct final content and remove the markers. `git add` each resolved file, then `git commit` (merge) or `git rebase --continue` (rebase) to finish — or abort the whole operation with `--abort` if needed.

**Q: What's the difference between `git stash pop` and `git stash apply`? (Intermediate)**
A: Both reapply a stashed change set to the working directory. `pop` also removes the entry from the stash stack afterward. `apply` leaves it on the stack, useful for applying the same stash to multiple branches or as a fallback if the reapplication has issues.

**Q: What's the difference between a lightweight and an annotated tag? (Intermediate)**
A: A lightweight tag is just a ref pointing directly at a commit SHA, no extra metadata. An annotated tag (`git tag -a`) is a full Git object storing tagger, date, message, and optionally a GPG signature, and it points at the commit rather than just being a pointer to it — the recommended choice for actual releases.

**Q: When would you use `git cherry-pick` instead of merge or rebase? (Intermediate)**
A: When you need one specific commit's changes on a different branch without bringing in the rest of that branch's history — the classic case is backporting a hotfix from `main` to an older release branch, using `-x` to record provenance for later auditing.

**Q: Compare the three PR merge strategies: merge commit, squash, and rebase. (Advanced)**
A: Merge commit preserves every original commit plus branch structure via a two-parent commit. Squash and merge collapses the branch's commits into one new commit on the target — cleanest target history, but per-commit granularity is lost there. Rebase and merge replays each commit individually onto the target's tip with new SHAs — linear like squash, but keeps commits separate.

**Q: How does Git Flow differ from trunk-based development and GitHub Flow? (Advanced)**
A: Git Flow uses permanent `main`/`develop` branches plus `feature`/`release`/`hotfix` supporting branches with defined merge rules, suited to scheduled, versioned releases. Trunk-based development uses one long-lived branch with only short-lived feature branches, often gated by feature flags, favoring continuous integration. GitHub Flow sits between them: one always-deployable `main`, short-lived PR-reviewed feature branches, no separate `develop`/`release` branches — because there's no distinct "next release" being stabilized.

**Q: Why doesn't Git immediately delete commits that become unreachable after a reset or rebase? (Advanced)**
A: Because the reflog holds references to them, and Git's garbage collector treats reflog entries as keeping their target objects alive. Objects only become eligible for real deletion once their reflog entry expires (default 90 days for reachable, 30 for already-unreachable entries) and `git gc` subsequently runs — the reflog is a time-bounded safety net, not permanent history.

**Q: What's the difference between `git push --force` and `git push --force-with-lease`? (Advanced)**
A: Both overwrite the remote branch with your local history. Plain `--force` does so unconditionally, silently discarding any commits a teammate pushed since your last fetch. `--force-with-lease` first checks the remote ref is still where your last fetch said it was; if it moved, the push is refused — protecting against accidentally clobbering someone else's work.

**Q: Why is `git cherry-pick`ing many individual commits a worse long-term choice than merging a branch normally? (Advanced)**
A: Each cherry-picked commit gets a new SHA distinct from the original. If that branch is later merged normally, Git doesn't reliably recognize the cherry-picked commits as "already applied," which can produce duplicate commits, redundant diffs, or conflicts during the eventual merge — it also fragments history, since the same logical change now exists as multiple unrelated commit objects.

**Q: In a fork-based workflow, what do `origin` and `upstream` typically mean, and why does that matter for staying in sync? (Advanced)**
A: `origin` is conventionally whatever you cloned from — in a fork workflow, that's your own fork. `upstream` is a remote you add explicitly pointing at the original/canonical repository, so `git fetch upstream` lets you pull the project's latest changes into your fork's `main` without conflating "my fork" and "the real project" under one remote name.

## How to Use This Folder

Read this README for the map, then work through two or three related topics together (e.g., Merge vs Rebase, Cherry Pick, and Conflict Resolution as a group, since they share mechanics). For each topic, practice a short spoken answer covering: the core mechanism, a real command example, the main tradeoff or gotcha, and how you'd debug or recover if it went wrong — that structure mirrors what a strong interview answer actually sounds like.
