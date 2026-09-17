# Pipeline

A Jenkins **pipeline** is a suite of plugins (the Pipeline plugin family) that models an entire build/test/deploy process as a single, resumable, code-defined workflow rather than a chain of separately configured freestyle jobs. The core building blocks are **stages** (logical, visually-tracked phases like "Build," "Test," "Deploy" — shown as segments in the Jenkins UI's pipeline graph) and **steps** (the individual actions within a stage, like `sh 'npm test'` or `checkout scm`). This structure gives a pipeline both machine behavior (what actually runs) and a human-readable shape (what stage failed, how long each phase took) for free.

Pipelines run on the Jenkins **Groovy** execution engine and are durable across controller restarts — if Jenkins restarts mid-build, a running pipeline can resume from roughly where it left off rather than being lost, which is a meaningful reliability property freestyle jobs don't have. Pipelines also support long-running, non-linear control flow that freestyle jobs can't express cleanly: parallel stages, conditional stages, manual approval gates (`input`), and retries.

Every pipeline needs an **agent** (where it runs), one or more **stages** (what it does, in order), and optionally a **post** section (cleanup/notification steps that run after the main stages regardless of, or dependent on, their outcome — `always`, `success`, `failure`, `unstable`, `changed`). Stages themselves contain **steps**, which are the actual pipeline DSL commands — shell/batch execution, checkout, artifact archiving, test result publishing, and hundreds more supplied by plugins.

Pipelines are defined using one of two syntaxes — declarative or scripted (covered in their own files) — but the concepts of stage, step, agent, and post apply to both; declarative just wraps them in a fixed structural grammar while scripted expresses the same ideas as free-form Groovy.

## Examples

Anatomy of a pipeline showing all the core concepts together:

```groovy
pipeline {
    agent any                       // where the pipeline runs
    options {
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }
    stages {                        // the ordered phases
        stage('Checkout') {
            steps {
                checkout scm         // a step
            }
        }
        stage('Build') {
            steps {
                sh 'make build'
            }
        }
        stage('Test') {
            steps {
                sh 'make test'
            }
        }
    }
    post {                          // runs after all stages
        always {
            junit 'test-results/*.xml'
        }
        failure {
            echo 'Build failed — notifying team'
        }
    }
}
```

Archiving build artifacts and publishing test results — two of the most commonly used steps in real pipelines:

```groovy
stage('Package') {
    steps {
        sh 'npm run build'
        archiveArtifacts artifacts: 'dist/**', fingerprint: true
    }
}
```

Using a manual approval gate before a production deploy stage — the `input` step pauses the pipeline until a human acts:

```groovy
stage('Deploy to Production') {
    steps {
        input message: 'Deploy to production?', ok: 'Deploy'
        sh './deploy.sh production'
    }
}
```

## Common Pitfalls / Gotchas

- Confusing a "stage" with a "step" — a stage is a visual/logical grouping in the pipeline graph; steps are the actual commands that run inside it. A pipeline can technically have zero stages structured incorrectly and still "work," but loses all the UI visualization value.
- Forgetting a `post { always { ... } }` block, leaving no guaranteed place to clean workspaces, archive logs, or send failure notifications regardless of outcome.
- Not setting `options { timeout(...) }`, letting a hung step (a step waiting on a network call that never returns) block an executor indefinitely.
- Treating `input` steps carelessly — a pipeline paused on `input` holds its executor (and, depending on configuration, can block agent capacity) until someone responds, which can silently stall a queue if nobody notices.
- Relying on pipeline state (like variables set in one stage) to persist correctly across stages that run on different agents — each agent has its own filesystem, so anything not explicitly passed via `stash`/`unstash` or environment variables doesn't carry over.

## Interview Questions & Answers

**Q: What is a Jenkins pipeline, and how does it differ conceptually from a freestyle job?**
A: A pipeline is a code-defined, resumable workflow made of stages and steps, capable of expressing parallelism, conditional logic, and multi-phase build/test/deploy processes in a single unit. A freestyle job is a single, linear, UI-configured build step sequence with no native concept of stages, and complex workflows require chaining multiple freestyle jobs together with upstream/downstream triggers instead.

**Q: What is the difference between a stage and a step?**
A: A stage is a named, logical phase of the pipeline (e.g., "Build," "Test") that shows up as a segment in Jenkins's pipeline visualization; a step is an individual action executed inside a stage, like running a shell command or checking out source code. Stages exist for structure and visibility; steps are what actually do the work.

**Q: What does the `post` section do, and what are its common conditions?**
A: `post` defines actions that run after all stages complete, regardless of (or conditioned on) the pipeline's outcome. Common conditions are `always` (runs no matter what — cleanup, archiving), `success`, `failure`, `unstable` (tests failed but build didn't), and `changed` (result differs from the previous run — useful for "back to green" notifications).

**Q: Why are Jenkins pipelines described as "durable," and why does that matter?**
A: Pipeline execution state is periodically checkpointed, so if the Jenkins controller restarts mid-build, a running pipeline can resume rather than being silently lost. This matters for long-running pipelines and for operational reliability — controller restarts (for upgrades, crashes) don't necessarily mean re-running every in-flight build from scratch.

**Q: What does the `input` step do, and what's a risk of using it carelessly?**
A: `input` pauses pipeline execution until a human approves (or aborts) it through the UI — commonly used as a manual gate before a production deployment. The risk is that a paused `input` step can hold onto an executor (and sometimes agent capacity) indefinitely if the approval request goes unnoticed, potentially starving other builds of capacity.

## Related Topics

- [declarative-pipeline.md](./declarative-pipeline.md)
- [scripted-pipeline.md](./scripted-pipeline.md)
- [jenkinsfile.md](./jenkinsfile.md)
- [parallel-stages.md](./parallel-stages.md)
- [pipeline-troubleshooting.md](./pipeline-troubleshooting.md)
