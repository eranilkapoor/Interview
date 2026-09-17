# Pull Requests

A pull request (PR — "merge request" on GitLab) is not a Git concept at all; it's a code-hosting-platform feature (GitHub, GitLab, Bitbucket) layered on top of Git's actual primitives. Git itself has no notion of "requesting" a merge — a PR is really a proposal, tracked by the platform, to merge one branch (or a fork's branch) into another, wrapped with review tooling: a diff view, inline comments, required approvals, CI status checks, and a UI-driven merge action that performs an ordinary `git merge` (or squash/rebase) on the server once approved.

The typical workflow: push a feature branch to the remote, open a PR against the target branch (usually `main` or `develop`) describing what changed and why, and the platform computes and displays the diff between the two branches. Reviewers leave inline comments on specific lines, request changes, or approve; CI pipelines run automatically against the PR's commits and report pass/fail as a required or informational check. Many teams also use **draft PRs** — opened early, before work is finished, explicitly marked as not-yet-ready-for-review — to get early CI feedback, enable collaboration on in-progress work, or simply signal "this exists, don't duplicate it" without implying it's ready to merge.

When a PR is approved, the platform offers (and usually lets admins restrict to) three merge strategies with materially different history outcomes. **Merge commit**: performs a real `git merge --no-ff`, creating a merge commit with two parents — preserves every individual commit from the branch plus the branch structure in history, at the cost of a noisier log. **Squash and merge**: combines every commit on the branch into a single new commit applied to the target branch — yields the cleanest possible target-branch history (one commit per PR) but discards the branch's internal commit-by-commit history (still viewable in the PR itself on the platform, just not in `git log` on the target branch afterward). **Rebase and merge**: replays each of the branch's individual commits onto the target branch's tip individually, like a manual `git rebase`, producing a linear history without a merge commit but keeping each original commit separate (with new SHAs).

Beyond mechanics, PRs are where code review actually happens on most teams, and interviewers frequently probe how candidates use that process: writing a clear PR description (what changed, why, how it was tested), keeping PRs small enough to review meaningfully, responding to feedback with new commits rather than force-pushed rewrites mid-review (so reviewers can see what changed since their last pass), and understanding that CI status checks and required approvals are policy enforced by the platform/branch protection rules, not by Git itself.

## Examples

```bash
# Push a feature branch and open a PR (GitHub CLI shown; same idea on any platform's UI)
git push -u origin feature/checkout-redesign
gh pr create --base main --head feature/checkout-redesign \
  --title "Redesign checkout flow" \
  --body "Simplifies the checkout form to 2 steps. Tested manually + new e2e tests."
```

```bash
# Respond to review feedback with new commits (don't force-push mid-review)
git add src/checkout/Form.tsx
git commit -m "Address review: validate email before submit"
git push origin feature/checkout-redesign
# Reviewers can now diff just the new commits since their last review pass
```

```bash
# After approval, a maintainer merges via the platform (illustrating what each
# strategy does under the hood, run locally for comparison):
git checkout main
git merge --no-ff feature/checkout-redesign     # "Merge commit" strategy
# --- OR ---
git merge --squash feature/checkout-redesign && git commit -m "Redesign checkout flow"  # "Squash and merge"
# --- OR ---
git rebase main feature/checkout-redesign && git checkout main && git merge feature/checkout-redesign  # "Rebase and merge" (fast-forward)
```

## Common Pitfalls / Gotchas

- Force-pushing to a branch in the middle of an active review to "clean up" commits — this rewrites SHAs reviewers already commented on, can make platform review UIs lose track of what's already been reviewed, and hides what actually changed since the last review pass.
- Opening enormous PRs that touch dozens of unrelated files, making meaningful line-by-line review effectively impossible and encouraging rubber-stamp approvals.
- Choosing "squash and merge" as a blanket policy without realizing it discards individual commit granularity on the target branch — fine for `git bisect`-style debugging only if the squashed commit messages are still informative.
- Merging with unresolved review comments or a red CI check because branch protection rules weren't configured to actually require them.
- Confusing a PR's diff view (branch vs. target at PR-open time, or vs. current target tip) with a full commit-by-commit history — a PR diff can look different from what actually lands depending on the merge strategy chosen.

## Interview Questions & Answers

**Q: Is a pull request a Git feature or a platform feature? Explain.**
A: A platform feature. Git itself has no "pull request" object or command — PRs are a GitHub/GitLab/Bitbucket construct that wraps Git's actual primitives (branches, diffs, merges) with review tooling: inline comments, required approvals, CI integration, and a UI-driven merge button. The underlying operation the platform performs on merge (a real `git merge`, squash, or rebase) is ordinary Git.

**Q: Compare the three common PR merge strategies: merge commit, squash, and rebase.**
A: Merge commit preserves every original commit plus the branch's structure via a two-parent merge commit — most historically complete, noisiest log. Squash and merge collapses all of a branch's commits into one new commit on the target branch — cleanest target history, but individual commit granularity is lost there (though still visible in the closed PR itself). Rebase and merge replays each original commit individually onto the target's tip with new SHAs — linear history like squash, but keeps commits separate rather than combining them into one.

**Q: What is a draft PR, and why would you open one?**
A: A PR explicitly marked as not ready for review/merge, used to get early CI feedback, share in-progress work for visibility or early input, or signal to teammates that work is underway without implying it's ready to be approved. It converts to a normal, reviewable PR once the author marks it ready.

**Q: Why is force-pushing to a branch under active review considered risky?**
A: It rewrites the commit SHAs reviewers have already seen and commented on. Depending on the platform, this can detach or hide previous inline comments' context, and it removes the ability for reviewers to diff "what changed since my last review" — they may end up having to re-review the entire PR from scratch instead of just the delta, which is exactly what pushing new commits (rather than rewriting existing ones) preserves.

**Q: What makes a PR easy to review well, from a process standpoint?**
A: Keeping it small and focused on one logical change, writing a description that explains what changed and why (not just restating the diff) plus how it was tested, responding to feedback with additional commits rather than rewriting history mid-review, and ensuring CI is green and required checks pass before requesting review — all of which reduce the cognitive load on reviewers and make the eventual approval meaningful rather than a rubber stamp.

## Related Topics

- [git-flow.md](./git-flow.md)
- [merge-vs-rebase.md](./merge-vs-rebase.md)
- [branches.md](./branches.md)
- [remote-repositories.md](./remote-repositories.md)
- [conflict-resolution.md](./conflict-resolution.md)
