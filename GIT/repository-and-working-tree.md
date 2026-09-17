# Repository and Working Tree

A Git repository is not "the folder with your code" — it's the `.git` directory living inside that folder. `.git` is a self-contained object database plus a set of references: every version of every file you've ever committed is stored there as a compressed, content-addressed object, along with the commit history graph and the branch/tag pointers into it. Delete everything else in the project and keep `.git`, and you can reconstruct the entire history. Delete `.git` and keep everything else, and you have plain files with no history at all.

Git objects are content-addressable: each blob (file contents), tree (directory listing), and commit object is identified by the SHA-1 (or SHA-256, on newer repos) hash of its own content. This means identical file content anywhere in history — even across different files or commits — is stored exactly once, and any change to content produces a completely different address. You never "edit" an object in place; you create a new one and point references at it.

Day to day, Git tracks your work across three areas, often called the "three trees": the **working tree** (the actual files on disk that you edit with your editor), the **index**, also called the **staging area** (a snapshot-in-progress of what the next commit will contain), and **HEAD** (a pointer to the last commit on your current branch, representing the last committed snapshot). `git status` is essentially a three-way diff report between these: working tree vs. index tells you what's staged/unstaged, and index vs. HEAD tells you what's about to be committed.

`git init` creates a brand-new, empty `.git` directory in the current folder — no history, no remotes, nothing but the skeleton. `git clone <url>` is different: it copies the *entire* object database and every ref (branches, tags) from the remote, sets up a remote named `origin` pointing back at that URL, creates local tracking branches, and checks out the default branch into a fresh working tree. After a clone, you have the full history offline — this is what makes Git "distributed" rather than requiring a central server for history operations like `git log` or `git blame`.

## Examples

```bash
# Initialize a new repo and inspect the three-trees relationship
git init my-project
cd my-project
echo "hello" > file.txt
git status
# Untracked files: file.txt  <- exists in working tree, not in index or HEAD

git add file.txt
git status
# Changes to be committed: file.txt  <- now in index, still not in HEAD (no commits yet)

git commit -m "Add file.txt"
git status
# nothing to commit, working tree clean  <- working tree, index, and HEAD all match
```

```bash
# Clone a remote repo and see what got set up
git clone https://github.com/octocat/Hello-World.git
cd Hello-World
git remote -v
# origin  https://github.com/octocat/Hello-World.git (fetch)
# origin  https://github.com/octocat/Hello-World.git (push)
git branch -vv
# * master  7fd1a60 [origin/master] first commit
```

```bash
# Inspect the raw objects that make up a commit
git cat-file -t HEAD          # commit
git cat-file -p HEAD          # tree <sha>, parent <sha>, author, committer, message
git cat-file -t HEAD^{tree}    # tree
git cat-file -p HEAD^{tree}    # lists blobs/trees for each file/dir at that commit

# Visualize the commit graph (a DAG, not a straight line)
git log --oneline --graph --all
```

## Common Pitfalls / Gotchas

- Conflating "the repository" (the full history in `.git`) with "the working copy of files." You can have a perfectly clean working tree while the repository holds hundreds of commits of history that files don't visually represent.
- Running `git init` inside an already-tracked directory (or cloning a repo into a subfolder of another repo) creates a nested `.git` — the outer repo sees the inner one as a gitlink (like an uninitialized submodule) rather than tracking its files normally, which is almost never what you want.
- Adding a pattern to `.gitignore` does **not** retroactively untrack files that are already committed — `.gitignore` only prevents *untracked* files from being picked up by `git add .` / shown in `git status`. Already-tracked files need `git rm --cached <file>` first.
- Bare repositories (`git init --bare`) have no working tree at all — just the `.git` object database's contents at the top level. They exist purely as a push/pull target (e.g., what lives on a server) and you can't edit files or run `git status` meaningfully inside one.

## Interview Questions & Answers

**Q: What exactly is stored inside `.git/`?**
A: The object database (blobs for file contents, tree objects for directory structure, commit objects linking trees to history, and tag objects), refs (branches and tags as pointers to commits), the index file (staging area), HEAD (pointer to the current branch/commit), hooks, and repo-level config. It's a complete, self-sufficient history store — nothing about history lives outside `.git`.

**Q: What is a bare repository, and when would you use one?**
A: A bare repository (`git init --bare`, or how repos are typically stored on GitHub/GitLab servers) has the contents of `.git` but no working tree — no checked-out files. It's meant purely as a shared remote that people push to and pull from, since you never edit files directly inside it; having a working tree there would risk someone pushing while files are checked out mid-edit.

**Q: Explain the three trees Git manages.**
A: The working tree is the actual files on disk. The index (staging area) is a snapshot of what will go into the next commit — it starts equal to HEAD and is updated by `git add`. HEAD points at the last commit on the current branch, the last snapshot Git has permanently recorded. `git diff` compares working tree to index; `git diff --staged` compares index to HEAD; `git status` reports on both comparisons at once.

**Q: What actually happens internally when you run `git clone`?**
A: Git opens a connection to the remote, negotiates and transfers all objects needed to reconstruct every ref's history (via the pack protocol), writes them into a new local `.git/objects` store, creates local refs mirroring the remote's branches/tags under `refs/remotes/origin/*`, sets up the `origin` remote in config, creates a local branch tracking the remote's default branch, and finally checks that branch's tree out into a new working directory.

## Related Topics

- [staging-area.md](./staging-area.md)
- [git-basics.md](./git-basics.md)
- [commits.md](./commits.md)
