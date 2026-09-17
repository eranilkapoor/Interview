# CI/CD

CI/CD is really three related but distinct practices stacked on top of each other. **Continuous Integration (CI)** means developers merge small changes into a shared main branch frequently (often multiple times a day), and every merge automatically triggers a build and test run — the point is to catch integration problems (two people's changes conflicting, or one change breaking another part of the system) within minutes of the merge instead of weeks later during a painful "integration phase." **Continuous Delivery (CD)** extends that pipeline so that every change which passes CI is automatically built into a release-ready artifact and pushed through staging environments — the software is *always* in a deployable state, but a human still clicks the button to release it to production. **Continuous Deployment** (also CD) goes one step further and removes that human gate entirely: every change that passes the full pipeline is deployed to production automatically, with no manual approval step at all.

The distinction between delivery and deployment matters a lot in interviews because people conflate them constantly, and the difference is really a statement about how much you trust your automated test suite and your rollback mechanisms — continuous deployment is only safe once your pipeline can actually catch the things that would have caused a human reviewer to say no. A typical pipeline runs through discrete stages: build (compile/bundle the code), unit test, static analysis/lint, package (produce a versioned artifact — a Docker image, a jar, a zip), integration/end-to-end test against that artifact, security/dependency scan, deploy to a staging or pre-prod environment, and finally deploy to production, often gated by a manual approval or an automatic promotion based on health checks. Each stage is a fast-fail gate: the pipeline stops at the first failing stage so nobody wastes time deploying something that's already known to be broken.

"Pipeline as code" is the modern default — the pipeline definition itself (which stages run, in what order, with what conditions) lives in a version-controlled file alongside the application code (a `Jenkinsfile`, a `.gitlab-ci.yml`, a GitHub Actions `.yml` workflow) instead of being configured by hand through a UI. This gives the pipeline the same benefits source code gets: code review on pipeline changes, history of who changed what and why, and the ability to reproduce the exact same pipeline on a different machine or fork. The deeper interview point connecting CI/CD back to DevOps culture is that a fast, trustworthy pipeline is what makes small, frequent changes economically viable — without it, every release carries so much manual verification overhead that teams naturally revert to big, infrequent, high-risk releases, which is the exact failure mode DevOps exists to fix.

## Examples

```yaml
# .github/workflows/ci.yml — a minimal CI pipeline as code
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm test -- --coverage
      - run: npm run build
```

```yaml
# Adding a deploy stage — this turns CI into continuous delivery
  deploy-staging:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - run: ./scripts/deploy.sh staging
      # Continuous DEPLOYMENT would add a production step here with
      # no manual approval gate; continuous DELIVERY stops here and
      # waits for a human to promote staging -> production.
```

```text
Pipeline stages, in the order a fast-fail pipeline runs them:

build -> unit test -> lint/static analysis -> package artifact ->
integration test -> security/dependency scan -> deploy: staging ->
[manual approval, if delivery not deployment] -> deploy: production
```

## Common Pitfalls / Gotchas

- Calling any automated deploy "CI/CD" without distinguishing delivery (human approves the release) from deployment (fully automatic) — interviewers will probe this distinction specifically.
- Building a pipeline with no fast-fail ordering, so a slow end-to-end test suite runs before a five-second lint check, wasting minutes on every commit that would have failed lint anyway.
- Treating "the build passed" as equivalent to "safe to deploy" — a green pipeline only means what your tests actually cover; a pipeline with weak test coverage gives false confidence.
- Configuring the pipeline by hand in a UI instead of as versioned pipeline-as-code, which makes changes to the release process invisible to code review and hard to reproduce.
- Skipping the deploy-and-monitor step — a deployment isn't actually finished until health checks, error rates, and key metrics confirm the new version is behaving correctly in production.

## Interview Questions & Answers

**Q: What's the difference between continuous delivery and continuous deployment?**
A: Both mean every change that passes the pipeline produces a release-ready, deployable artifact. Continuous delivery stops there and waits for a human to approve the actual release to production. Continuous deployment removes that manual gate — a passing pipeline deploys straight to production automatically. The difference is really a trust statement about how good your automated tests and rollback mechanisms are.

**Q: Why should tests run in a specific order in a CI pipeline rather than all at once?**
A: For fast feedback — cheap, fast checks (lint, unit tests) should run before slow, expensive ones (integration tests, security scans) so a commit that's obviously broken fails in seconds instead of after a ten-minute end-to-end suite. This "fail fast" ordering keeps the feedback loop short, which is the entire point of CI.

**Q: What does "pipeline as code" mean and why does it matter?**
A: It means the CI/CD pipeline's definition — stages, order, conditions — lives in a version-controlled file in the repo instead of being configured manually through a UI. It matters because it gives the pipeline the same guarantees as application code: code review on changes to the release process, a history of who changed what, and the ability to reproduce the exact pipeline elsewhere (a new environment, a fork, disaster recovery).

**Q: How would you debug a CI pipeline that's flaky — passing and failing intermittently on the same commit?**
A: Start by separating environment flakiness (shared test databases, network calls to real external services, race conditions in parallel test runs) from genuinely non-deterministic code (unseeded randomness, timing-dependent assertions). Re-run in isolation to rule out resource contention, check if failures cluster around specific tests, and prefer fixing the root cause over retry-until-green, since retries hide real bugs and erode trust in the pipeline's signal.

**Q: What's a senior-level consideration when designing a CI/CD pipeline beyond "make it pass tests"?**
A: Deployment safety mechanisms beyond the tests themselves — how does a bad deploy get detected in production (health checks, error-rate monitoring) and how fast can it be rolled back? A pipeline is only as trustworthy as its ability to catch and reverse mistakes that slip past automated tests, which is why CI/CD is usually discussed alongside release strategies like canary and blue-green deployment.

## Related Topics

- [source-code-management.md](./source-code-management.md)
- [release-strategies.md](./release-strategies.md)
- [infrastructure-as-code.md](./infrastructure-as-code.md)
- [monitoring-and-logging.md](./monitoring-and-logging.md)
