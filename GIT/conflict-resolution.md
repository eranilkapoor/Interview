# Conflict Resolution

Conflict Resolution belongs to the GIT skill set. In interviews, it is useful because it shows whether you can connect theory with the way real systems are built, tested, deployed, and maintained.

The right mental model is: version control, branching, commits, remotes, history management, collaboration workflows, and safe recovery. A strong answer should explain the core idea, the normal workflow, the tradeoffs, and the failure modes. Avoid memorized one-line definitions; interviewers usually follow up by asking how you used the concept in a project or how you would debug it under pressure.

For teaching, begin with the problem, then show the smallest practical example, then discuss what changes at production scale. That makes the topic easier to remember and easier to adapt when the interviewer changes the constraints.

## Examples

~~~bash
git status
git add src/app.ts
git commit -m "Explain focused change"
~~~

This example gives a practical anchor for the topic so you can explain the workflow rather than only naming the concept.

~~~bash
git fetch origin
git rebase origin/main
# Rebase local work carefully; do not rewrite shared history casually.
~~~

This example highlights how Conflict Resolution connects to real project decisions: configuration, safety, performance, or maintainability.

~~~bash
# Interview checklist for Conflict Resolution
echo "Problem solved"
echo "Main mechanism"
echo "Tradeoffs"
echo "Debugging and production concerns"
~~~

Use this checklist when answering follow-up questions. It keeps the answer structured and prevents you from missing operational details.

## Common Pitfalls / Gotchas

- Using destructive history commands without understanding what they rewrite.
- Making huge unfocused commits that are hard to review or revert.
- Confusing merge, rebase, reset, revert, and restore.
- Resolving conflicts mechanically without rerunning tests.

## Interview Questions & Answers

**Q: What is Conflict Resolution in the context of GIT?**  
A: It is a GIT topic that helps solve problems around version control, branching, commits, remotes, history management, collaboration workflows, and safe recovery. The best answer explains the problem first, then the mechanism, then a real example.

**Q: When would you use Conflict Resolution in a production project?**  
A: Use it when the project requirement matches the problem it solves and the tradeoffs are acceptable. Also explain how you would test, monitor, secure, or roll back the implementation.

**Q: What should you compare Conflict Resolution with?**  
A: Compare it with simpler alternatives in the same stack. Mention complexity, performance, team familiarity, deployment impact, and long-term maintenance.

**Q: How would you debug an issue related to Conflict Resolution?**  
A: Start by reproducing the issue, checking configuration and logs, isolating the smallest failing case, and validating assumptions with tooling specific to GIT.

**Q: What is a senior-level point to mention?**  
A: Senior answers include ownership, observability, failure recovery, security boundaries, cost or resource usage, and how the decision affects other teams.

## Related Topics

- [branches.md](./branches.md)
- [cherry-pick.md](./cherry-pick.md)
- [commits.md](./commits.md)
