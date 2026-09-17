# Git Basics

Git is a distributed version control system: unlike centralized systems where history lives only on a server, every clone contains the *entire* project history, meaning most operations (log, diff, commit, branch) run entirely locally without touching a network. The core workflow revolves around three areas — often called the "three trees" — that every Git command manipulates in some combination: the **working directory** (the actual files you see and edit on disk), the **staging area / index** (a snapshot-in-progress of what will become the next commit), and the **repository** (`.git`, the permanent, committed history).

`git init` creates a new, empty `.git` directory in the current folder, turning it into a repository with no history and no remotes — just the skeleton needed to start tracking. `git clone <url>` does something bigger: it copies the *entire* object database and every ref from a remote, sets up a remote named `origin` pointing back at that URL, and checks out a working copy of the default branch — after cloning you have the full history offline, which is the defining trait of a distributed VCS versus needing constant server access.

The everyday loop is: edit files in the working directory, `git add` the ones you want in the next commit (moving them into the staging area), `git commit` to permanently record whatever is staged as a new snapshot in the repository, and `git status` / `git log` to see where things stand at any point. `git status` reports a three-way comparison — untracked/modified files in the working directory versus the index, and staged changes in the index versus the last commit (HEAD) — which is why its output has separate "Changes to be committed" and "Changes not staged for commit" sections.

Understanding the three trees deeply is arguably the single highest-leverage piece of Git knowledge for an interview, because nearly every other command (`diff`, `restore`, `reset`, `stash`, `commit`) is easiest to reason about as "moving or comparing data between working directory, index, and HEAD." Once that model is solid, commands that otherwise feel like arbitrary incantations (why does `git diff` show nothing after `git add`? why does `git reset --soft` leave files staged?) become predictable.

## Examples

```bash
# Initialize a new repo and watch the three trees diverge and converge
git init my-project && cd my-project
echo "hello" > file.txt
git status
# Untracked files: file.txt        <- in working dir only

git add file.txt
git status
# Changes to be committed: file.txt <- now also in the index

git commit -m "Add file.txt"
git status
# nothing to commit, working tree clean  <- working dir, index, HEAD all match
```

```bash
# Clone an existing remote repo and inspect what got set up
git clone https://github.com/octocat/Hello-World.git
cd Hello-World
git remote -v          # origin fetch/push URLs
git log --oneline -5   # full history is available locally, offline
```

```bash
# The daily loop: check status, review the diff, stage, commit, review log
git status
git diff                       # working dir vs. index (unstaged changes)
git add -p                     # stage selected hunks interactively
git diff --staged              # index vs. HEAD (what will be committed)
git commit -m "Handle empty search results"
git log --oneline --graph -10
```

## Common Pitfalls / Gotchas

- Running `git add .` without checking `git status` first and accidentally staging build artifacts, `.env` files, or other things that should be in `.gitignore`.
- Believing `git status` shows one list of "changes" — it actually reports two separate comparisons (working dir vs. index, index vs. HEAD), and conflating them causes confusion about what will actually be committed.
- Forgetting that `.gitignore` only prevents *untracked* files from being picked up — it does nothing to files that are already tracked; those need `git rm --cached` to stop tracking.
- Assuming `git clone` only gets the latest snapshot — it pulls the full history by default, which is why cloning a very old, large repo can be slow/large even though you only want the current files.
- Not running `git status` before a destructive operation and losing track of what's staged versus unstaged versus untracked.

## Interview Questions & Answers

**Q: Explain the three trees Git manages and how `git status` relates to them.**
A: The working directory is the actual files on disk. The index (staging area) holds a snapshot of what will go into the next commit, updated by `git add`. HEAD points at the last commit on the current branch — the last permanently recorded snapshot. `git status` reports two comparisons at once: working directory vs. index (unstaged changes) and index vs. HEAD (staged changes ready to commit).

**Q: What's the difference between `git init` and `git clone`?**
A: `git init` creates a brand-new, empty `.git` directory with no history and no remotes — just the skeleton. `git clone <url>` copies an existing repository's entire object database and refs from a remote, configures a remote named `origin`, creates local tracking branches, and checks out a working copy — you end up with the complete history available offline, not just the current files.

**Q: Why is Git called a "distributed" version control system?**
A: Because every clone contains the full project history (every commit, branch, and tag reachable at clone time), not just a checkout of the current files. This means operations like `log`, `diff`, `commit`, and `branch` work entirely offline against local data — only `fetch`, `pull`, and `push` need the network, unlike centralized systems where most history operations require contacting a central server.

**Q: What does `git add` actually do, mechanically?**
A: It reads the current content of the specified file(s) from the working directory, writes it into the object database as a blob (if that exact content isn't already stored), and updates the index to record that path as pointing at that blob's SHA. It captures a snapshot of the file *at that exact moment* — further edits to the file afterward aren't reflected until you `git add` again.

**Q: If you delete `.git` but keep all your project files, what have you lost? What if it's reversed?**
A: Deleting `.git` and keeping the files loses all history — you're left with plain files and no way to see past versions, diffs, or commits; it's no longer a Git repository at all. Deleting everything except `.git` loses nothing recoverable — you can run `git checkout` (or `git restore .`) against HEAD to reconstruct the entire working directory from the object database, since `.git` alone is fully self-sufficient.

## Related Topics

- [repository-and-working-tree.md](./repository-and-working-tree.md)
- [staging-area.md](./staging-area.md)
- [commits.md](./commits.md)
- [remote-repositories.md](./remote-repositories.md)
- [branches.md](./branches.md)
