# Waterfall Model

The waterfall model is a linear, sequential approach to software delivery: requirements gathering, design, implementation, testing, deployment, and maintenance happen one after another, each phase gated on the previous one being signed off and documented. There is no formal mechanism for looping back — if testing reveals that a requirement was misunderstood, the fix has to travel back up through design and implementation, which is expensive precisely because the process wasn't built to expect it. The model comes from manufacturing and construction, where you genuinely can't pour the foundation after the walls are up, and it was mapped onto software in the 1970s under the same assumption: that requirements can be fully known and frozen before any code is written.

The core tradeoff is predictability versus adaptability. Waterfall gives you a detailed upfront plan, a fixed scope, and an easy-to-communicate schedule — which is attractive to contracts, audits, and stakeholders who need a fixed price and a fixed date. The cost is that it front-loads all your risk into the requirements phase: if the requirements are wrong, incomplete, or the market shifts, you don't find out until you're deep into implementation or even testing, when the fix is far more expensive than it would have been if you had shipped something small and validated it early. This is the central argument agile methodologies make against it: software requirements are rarely fully knowable in advance, so a process optimized for "get it right once" is fighting the nature of the problem.

Waterfall isn't obsolete, though — it's a poor fit for some projects and a reasonable one for others. It still shows up in regulated environments (medical devices, aerospace, government contracts) where requirements really are fixed by external mandate, where extensive upfront documentation is a compliance requirement rather than overhead, and where the cost of a late-stage change (recertification, re-audit) dwarfs the cost of a slower planning phase. It's a reasonable choice when the problem domain is well understood, the technology is mature, and the team has done nearly the same project before. It's a poor choice for anything exploratory — new products, unclear requirements, or fast-moving markets — where you need feedback loops shorter than "wait until the end of the project."

## Examples

```text
Waterfall phases (each gated by sign-off on the previous):

1. Requirements gathering & analysis  →  Requirements Specification doc
2. System & software design          →  Design doc / architecture diagrams
3. Implementation                    →  Code, built to the design doc
4. Testing (integration, QA, UAT)    →  Test reports, defect logs
5. Deployment                        →  Release to production
6. Maintenance                       →  Bug fixes, patches, minor enhancements
```

```text
Why a late requirements change is expensive in waterfall:

Requirements  -->  Design  -->  Implementation  -->  Testing
     ^                                                  |
     |__________________________________________________|
     A defect traced back to a bad requirement here means
     re-doing design + implementation + re-testing — not
     just a code fix.
```

## Common Pitfalls / Gotchas

- Assuming "waterfall" means "no planning discipline" when the opposite is true — it usually involves more upfront documentation than agile, not less.
- Using waterfall for a project where requirements are genuinely uncertain (new product, unclear customer needs) — this is the scenario where waterfall's rigidity causes the most damage.
- Treating each phase gate as a rubber stamp instead of a real review — skipping rigor at the sign-off defeats the model's main safety mechanism.
- Confusing waterfall with "big design up front" in general — you can do disciplined upfront design inside an agile process too; the defining trait of waterfall is the *lack of iteration back to earlier phases*, not the presence of planning.
- Bringing "waterfall thinking" into a DevOps interview as a straw man — interviewers want to see that you understand *when* it's still appropriate, not just that you can criticize it.

## Interview Questions & Answers

**Q: What is the waterfall model, and how does it differ from agile?**
A: Waterfall is a linear, sequential development process — requirements, design, implementation, testing, deployment, maintenance — where each phase completes and is signed off before the next begins, with no built-in mechanism to revisit earlier phases. Agile replaces that single long sequence with many short iterations (sprints), each producing a working increment and a feedback loop, so requirements can evolve as understanding improves instead of being frozen upfront.

**Q: When would you actually choose waterfall over agile today?**
A: When requirements are genuinely fixed and well understood in advance — often due to regulatory or contractual constraints (medical devices, aerospace, fixed-price government contracts) — and when extensive upfront documentation is itself a deliverable, not overhead. It's also reasonable for a small, well-understood project the team has built similar versions of before, where the risk of hidden requirements is low.

**Q: What's the biggest risk of using waterfall on a project with uncertain requirements?**
A: You don't get feedback until testing or deployment, which is the most expensive point to discover that a requirement was wrong. Because there's no iteration loop, that discovery forces rework across design and implementation instead of a cheap course-correction, which is exactly the failure mode agile's short feedback loops are designed to avoid.

**Q: Can you combine waterfall and agile in the same project?**
A: Yes — this is often called a "water-scrum-fall" hybrid in practice. Teams sometimes do waterfall-style upfront requirements and architecture (useful when external stakeholders need a fixed plan) but execute the actual build in agile sprints with iterative feedback, then close with a waterfall-style formal QA/release phase for compliance sign-off.

**Q: What single trait most distinguishes waterfall from every iterative model?**
A: The absence of a built-in feedback loop back to earlier phases. Iterative models (agile, spiral, incremental) all assume you'll learn something during a later phase that changes an earlier decision, and they build a cheap path to act on that. Waterfall assumes you got the earlier phase right the first time.

## Related Topics

- [agile-methodology.md](./agile-methodology.md)
- [devops-culture.md](./devops-culture.md)
- [ci-cd.md](./ci-cd.md)
