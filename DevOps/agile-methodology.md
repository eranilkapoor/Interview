# Agile Methodology

Agile is an iterative approach to software delivery built around short cycles, frequent feedback, and the assumption that requirements will change as understanding improves — the opposite bet from waterfall's "get requirements right once." Instead of one long sequence of phases, work is broken into small increments (commonly two-to-four-week sprints in Scrum, or a continuous pull-based flow in Kanban) each of which produces something demonstrable. The Agile Manifesto's core values capture the philosophy directly: individuals and interactions over processes and tools, working software over comprehensive documentation, customer collaboration over contract negotiation, and responding to change over following a plan. None of those pairs mean the second thing has no value — they mean agile teams prioritize the first when the two are in tension.

Scrum is the most common agile framework in interviews and gives it concrete mechanics: a Product Backlog of prioritized work, a time-boxed Sprint during which a cross-functional team commits to a Sprint Backlog pulled from the top of that list, a daily Standup (What did I do yesterday? What will I do today? What's blocking me?) to surface impediments early, a Sprint Review to demo the increment to stakeholders, and a Sprint Retrospective for the team to inspect and adapt its own process. Backlog grooming (refinement) is the ongoing work of breaking large items down, estimating them (story points, planning poker), and re-prioritizing so the top of the backlog is always sprint-ready. Kanban is a lighter alternative: no fixed-length sprints, just a continuous board with WIP (work-in-progress) limits per column that force the team to finish work before starting more, and flow metrics like cycle time and lead time instead of sprint velocity.

Velocity — the average amount of work (usually story points) a team completes per sprint — is a planning tool, not a performance metric; using it to compare teams or push for more output is a well-known way to destroy its usefulness, because teams will just inflate estimates. The deeper interview point is that agile is a risk-management strategy: by shipping a working increment every sprint and getting real feedback, you convert "we might have built the wrong thing" from a project-ending discovery at the end into a cheap course-correction every couple of weeks. That's the direct throughline to DevOps and CI/CD — agile shortens the feedback loop on *what* to build, CI/CD shortens the feedback loop on *whether what you built works in production*, and both exist to reduce the cost of being wrong.

## Examples

```text
A two-week Scrum sprint, mechanically:

Day 1:      Sprint Planning — pull top items from backlog into Sprint Backlog
Day 2-9:    Daily Standup (15 min) + development, code review, testing
Day 10:     Sprint Review — demo the increment to stakeholders
Day 10:     Sprint Retrospective — team inspects its own process
            (repeat)
```

```text
Kanban board with WIP limits (numbers cap items per column):

  Backlog  |  To Do (3)  |  In Progress (2)  |  Review (2)  |  Done
  ---------|-------------|-------------------|--------------|------
  item F   |  item C     |  item A           |  item ...    |  ...
  item G   |  item D     |  item B           |
  item H   |  item E

If "In Progress" is already at 2, nobody pulls a new item into it
until something moves to Review — this is what makes Kanban a
pull system instead of a push system.
```

## Common Pitfalls / Gotchas

- Treating Scrum ceremonies as theater — a standup that turns into a status report to a manager, rather than the team surfacing blockers to each other, misses the point.
- Using velocity as a productivity metric or comparing it across teams — it's a team-local capacity-planning number, and turning it into a KPI just causes estimate inflation.
- Confusing "agile" with "no planning" — agile still plans, just in short horizons with cheap course-correction instead of one long upfront commitment.
- Letting the backlog go ungroomed, so sprint planning turns into estimating vague, oversized items on the spot instead of pulling from already-refined, right-sized work.
- Ignoring WIP limits in Kanban — a board with no limits just becomes a to-do list with extra steps, and loses the flow-control benefit that makes Kanban work.

## Interview Questions & Answers

**Q: What's the core difference between Scrum and Kanban?**
A: Scrum organizes work into fixed-length, time-boxed sprints with a defined set of ceremonies (planning, standup, review, retrospective) and a velocity-based capacity model. Kanban has no fixed iterations — it's a continuous pull system visualized on a board, constrained by WIP limits per stage, and measured with flow metrics like cycle time rather than sprint velocity. Scrum suits work that can be batched into predictable increments; Kanban suits continuous flows like support or ops work where items arrive unpredictably.

**Q: Why does agile favor short iterations over a single upfront plan?**
A: Because software requirements are rarely fully known in advance, and the cost of discovering you built the wrong thing grows the longer you wait to get feedback. Short iterations produce a working increment every sprint, so a wrong assumption gets caught and corrected within weeks instead of at the very end of a long waterfall-style project, where rework is far more expensive.

**Q: What is a sprint retrospective for, and how is it different from a sprint review?**
A: A sprint review demonstrates the *product* increment to stakeholders and gathers feedback on what was built. A retrospective looks inward at the team's *process* — what went well, what didn't, and what to change next sprint — and is where the team owns its own continuous improvement rather than having it imposed from outside.

**Q: How do you keep a backlog "sprint-ready"?**
A: Through ongoing backlog grooming/refinement — regularly breaking large, vague items down into smaller, well-defined ones, estimating them, and reordering by priority, so that when sprint planning happens the top of the backlog is already small enough and clear enough to commit to without surprises.

**Q: What's a common way agile gets misapplied in practice?**
A: "Water-scrum-fall" — teams adopt the ceremonies (standups, sprints) without the underlying feedback loop, still doing big upfront requirements and design, still batching QA and release at the very end. You get the meeting overhead of agile without its actual risk-reduction benefit, because the feedback loop that makes agile work never actually gets short.

## Related Topics

- [waterfall-model.md](./waterfall-model.md)
- [devops-culture.md](./devops-culture.md)
- [ci-cd.md](./ci-cd.md)
- [release-strategies.md](./release-strategies.md)
