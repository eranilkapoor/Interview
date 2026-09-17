# Jenkins Interview Prep

This folder is a personal knowledge base for studying and teaching Jenkins and CI/CD concepts, built for interview preparation and for explaining these topics to others. Each file covers one topic in depth — a conceptual explanation, real Jenkinsfile/CLI/config examples, common pitfalls, and interview-style Q&A — so you can both refresh your own understanding quickly and use the material to walk someone else through the same concept from scratch.

## Table of Contents

### Getting Started
- [Introduction to Jenkins](./introduction-to-jenkins.md)
- [Installing Jenkins](./installing-jenkins.md)
- [Using Jenkins](./using-jenkins.md)

### Jobs & Pipelines
- [Freestyle vs Pipeline](./freestyle-vs-pipeline.md)
- [Pipeline](./pipeline.md)
- [Jenkinsfile](./jenkinsfile.md)
- [Declarative Pipeline](./declarative-pipeline.md)
- [Scripted Pipeline](./scripted-pipeline.md)
- [Parallel Stages](./parallel-stages.md)

### Infrastructure & Scaling
- [Agents and Executors](./agents-and-executors.md)
- [Webhooks (Build Triggers)](./webhooks.md)

### Security
- [Credentials Management](./credentials-management.md)

### Deployment Strategy & Operations
- [Blue-Green Deployment](./blue-green-deployment.md)
- [Pipeline Troubleshooting](./pipeline-troubleshooting.md)

## Interview Questions & Answers — Curated

**1. What is Jenkins, and what problem does it solve? (Beginner)**
Jenkins is a self-hosted, open-source automation server that runs build/test/deploy steps in response to triggers (a push, a schedule, a manual click), solving the problem of manually and inconsistently building, testing, and releasing software. See [introduction-to-jenkins.md](./introduction-to-jenkins.md).

**2. What's the difference between declarative and scripted pipeline syntax, and which should you default to? (Intermediate)**
Declarative wraps a Jenkinsfile in a fixed, validated `pipeline { }` structure with defined sections (`agent`, `stages`, `post`); scripted is arbitrary Groovy inside `node { }` with no structural constraints. Declarative is the modern recommended default for nearly all pipelines — easier to read, validated up front, and better visualized in the UI — with scripted (or a declarative `script { }` step) reserved for genuinely dynamic logic. See [declarative-pipeline.md](./declarative-pipeline.md) and [scripted-pipeline.md](./scripted-pipeline.md).

**3. What is a Jenkinsfile, and why does it matter for how Jenkins is used today? (Beginner/Intermediate)**
A Jenkinsfile is a text file, checked into source control, defining a pipeline as code. It matters because it makes the build/deploy process versioned, code-reviewable, and reproducible per commit/branch — the foundation of the "pipeline as code" practice essentially all modern Jenkins usage relies on. See [jenkinsfile.md](./jenkinsfile.md).

**4. How do Jenkins controllers and agents divide responsibility, and how does that let Jenkins scale builds? (Intermediate/Advanced)**
The controller schedules work and serves the UI/config but ideally doesn't execute builds itself; agents are separate machines/containers, each exposing executors, that actually run build steps. Adding capacity means adding more agents (or more executors), not scaling the controller, and keeping builds off the controller isolates untrusted build workloads from the system holding all credentials. See [agents-and-executors.md](./agents-and-executors.md).

**5. How do you manage secrets in a Jenkinsfile without ever exposing them in source control? (Intermediate)**
Store secrets in the Jenkins credentials store with a unique ID, then reference that ID from the Jenkinsfile via `credentials()` in an `environment` block or `withCredentials([...])` — the actual value is injected at runtime and Jenkins masks it from known console output, but the Jenkinsfile itself never contains the plaintext secret. See [credentials-management.md](./credentials-management.md).

**6. What's the difference between a Freestyle job and a Pipeline job? (Beginner)**
Freestyle jobs are configured through UI form fields and stored only in Jenkins's internal state — simple but not versioned and unable to express multi-stage/parallel/conditional logic natively. Pipeline jobs run a Jenkinsfile, giving full version control, code review, and native support for stages, parallelism, and conditional logic. See [freestyle-vs-pipeline.md](./freestyle-vs-pipeline.md).

**7. How would you cut a pipeline's wall-clock time using parallelism, and what's the trade-off of `failFast`? (Intermediate/Advanced)**
Wrap independent work (test suites, linting, multi-platform builds) in a `parallel { }` block so total time is bounded by the slowest branch rather than the sum of all branches. `failFast: true` aborts remaining branches as soon as one fails, giving a faster failure signal at the cost of not seeing whether the other in-progress branches would also have failed. See [parallel-stages.md](./parallel-stages.md).

**8. What's the difference between a webhook trigger and polling, and when would you choose polling? (Intermediate)**
A webhook is Jenkins reacting instantly to an HTTP callback from the SCM host on a push/PR event; polling is Jenkins periodically checking the SCM for changes on a schedule. Polling is the right choice when Jenkins can't be reached by an inbound webhook (behind a firewall), at the cost of a delay bounded by the polling interval. See [webhooks.md](./webhooks.md).

**9. What is blue-green deployment, and how would you orchestrate it in a Jenkins pipeline? (Advanced)**
Blue-green runs two identical environments, deploys the new version to the idle one, verifies it, then flips live traffic to it via a router/load balancer — rollback is just flipping traffic back. In a pipeline: deploy to idle, smoke-test, optionally gate behind an `input` approval, then switch traffic; rollback is a separate, simple stage. See [blue-green-deployment.md](./blue-green-deployment.md).

**10. What is a Shared Library, and what problem does it solve? (Advanced)**
A Shared Library is a separate, versioned Groovy repository of reusable pipeline steps that multiple Jenkinsfiles can import via `@Library('name') _`, solving the problem of duplicating the same build/deploy logic across many repositories' Jenkinsfiles. See [jenkinsfile.md](./jenkinsfile.md).

**11. How does Jenkins automatically build every branch/PR in a repository without manual per-branch job setup? (Intermediate)**
Through a Multibranch Pipeline (or Organization Folder) job, which periodically scans a repository's branches/PRs and automatically creates, updates, or removes a pipeline job for each one that contains a Jenkinsfile. See [using-jenkins.md](./using-jenkins.md) and [webhooks.md](./webhooks.md).

**12. What does the `post` section in a declarative pipeline do, and what are its common conditions? (Beginner/Intermediate)**
`post` defines actions that run after all stages complete, regardless of (or conditioned on) outcome — `always` (cleanup, archiving), `success`, `failure`, `unstable`, and `changed` (result differs from the previous run). See [pipeline.md](./pipeline.md).

**13. A pipeline passes on one agent but fails on another — what would you check? (Intermediate/Advanced)**
Tool version differences between agents, leftover workspace state from a previous build, or environment/OS differences the pipeline implicitly relies on — pinning versions via `tools { }` or moving to ephemeral containerized agents eliminates most of this failure class. See [pipeline-troubleshooting.md](./pipeline-troubleshooting.md) and [agents-and-executors.md](./agents-and-executors.md).

**14. What's the difference between blue-green deployment and canary deployment? (Advanced)**
Blue-green does an instant, complete traffic switch between two full environments with equally fast, complete rollback. Canary gradually shifts a small, increasing percentage of traffic to the new version while monitoring for problems, trading a slower rollout for a smaller blast radius. See [blue-green-deployment.md](./blue-green-deployment.md).

**15. What is Blue Ocean, and how does it relate to the classic Jenkins UI? (Beginner/Intermediate)**
Blue Ocean is a plugin providing an alternate, pipeline-focused UI with a cleaner visual stage flow and a guided declarative pipeline editor. It runs on top of the same pipeline execution as the classic UI — it changes visualization and editing, not how pipelines actually run — and some administrative functionality remains classic-UI-only. See [using-jenkins.md](./using-jenkins.md).

**16. How would you handle a genuinely flaky pipeline step without masking a real underlying bug? (Advanced)**
Wrap just the specific flaky step (not the whole pipeline) in `retry(n) { ... }`, and continue investigating the root cause in parallel — treating retries as a permanent fix instead of a stopgap just hides a real problem indefinitely. See [pipeline-troubleshooting.md](./pipeline-troubleshooting.md).

**17. Why would an organization keep build execution off the Jenkins controller entirely? (Intermediate/Advanced)**
Running builds on the controller couples untrusted build workload to the one system that manages scheduling and holds credentials for every downstream system Jenkins deploys to — a compromised or resource-exhausted build can destabilize or compromise the whole instance. Dedicated agents isolate execution and let capacity scale independently. See [agents-and-executors.md](./agents-and-executors.md) and [installing-jenkins.md](./installing-jenkins.md).

**18. How do declarative pipelines handle logic that doesn't fit the fixed grammar (loops, complex conditionals)? (Intermediate)**
Wrap that specific logic in a `script { }` step inside `steps { }`, which executes as full scripted-pipeline Groovy while the rest of the pipeline stays declarative. See [declarative-pipeline.md](./declarative-pipeline.md) and [scripted-pipeline.md](./scripted-pipeline.md).

**19. What are the main ways to install Jenkins, and which would you pick for a new project? (Beginner)**
Native OS package, WAR file in a servlet container, Docker container, or Helm chart on Kubernetes. The official Docker image with a persistent named volume for `JENKINS_HOME` is a common default — reproducible, portable, and easy to upgrade by changing the image tag. See [installing-jenkins.md](./installing-jenkins.md).

**20. What's a risk of Jenkins's automatic secret masking in console output, and how would you avoid it? (Advanced)**
Masking only catches known credential values printed verbatim — a value that's transformed (base64-encoded, concatenated into a larger string) before being printed can bypass masking and leak in plaintext. Avoid printing credential-derived values at all, and scope credentials tightly with `withCredentials` rather than exporting them more broadly than needed. See [credentials-management.md](./credentials-management.md).

## How to Use This Folder

Work through the sections roughly in order: **Getting Started** establishes what Jenkins is and how to stand one up; **Jobs & Pipelines** covers the actual mechanics of defining and running work (this is the bulk of day-to-day Jenkins knowledge and where most interview questions concentrate); **Infrastructure & Scaling** and **Security** cover how Jenkins operates at team/production scale; **Deployment Strategy & Operations** applies all of the above to a real end-to-end scenario (blue-green) and to debugging when things go wrong.

For interview prep specifically: skim each file's own "Interview Questions & Answers" section for topic-level review, then use the "Curated" list above as a cross-cutting mock-interview pass once you've refreshed the individual topics — it deliberately mixes beginner, intermediate, and advanced questions the way a real interview would.
