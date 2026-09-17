# Pipeline Troubleshooting

Debugging a failed or misbehaving Jenkins pipeline follows a fairly consistent path: start with the **console output** of the specific failed build — it's the ground truth for what actually happened, including the exact command that failed and its output. For declarative pipelines, the failure is also attributed to a specific stage in the pipeline graph, which immediately narrows down where in the process things went wrong before you even open the log. From there, the key diagnostic question is whether the failure is a genuine code/test regression (the pipeline is working correctly and reporting a real problem) or an infrastructure/environment issue (agent unavailable, network flake, disk full, plugin incompatibility) — these require completely different fixes, and conflating them wastes time.

A large class of Jenkins-specific failures come from environment differences between agents — a pipeline that passes on one agent and fails on another usually points to a tool version mismatch, a missing dependency, or workspace state left over from a previous build. Using `tools { }` blocks or containerized/ephemeral agents to pin exact tool versions, and cleaning workspaces (`cleanWs()` or fresh containers per build) between runs, eliminates most of this category of flakiness. Another common source is credential/permission issues — a step failing with an authentication error, especially one that "used to work," often traces back to an expired token, a credential ID that changed, or a permission scope that was tightened.

For pipeline syntax or logic errors specifically, the "Replay" feature (available on completed pipeline runs) lets you edit the Jenkinsfile and re-run it without committing anything, which is invaluable for iterating on a fix quickly rather than pushing a commit per attempt. The `Pipeline Syntax` generator (linked from any pipeline job) helps produce correct step syntax by walking through a step's parameters in a form, then generating the equivalent Groovy — useful when you're not sure of a step's exact argument names.

For flaky, hard-to-reproduce failures (intermittent test failures, occasional agent connectivity blips), the right response is usually to add retries (`retry(n) { ... }` around the specific flaky step, not the whole pipeline) combined with genuinely investigating and fixing the root cause over time — masking flakiness with retries indefinitely just hides a real problem rather than solving it.

## Examples

Using `retry` to handle a known-flaky network-dependent step without masking a genuine failure elsewhere in the pipeline:

```groovy
stage('Install dependencies') {
    steps {
        retry(3) {
            sh 'npm ci'
        }
    }
}
```

Cleaning the workspace at the start and end of a build to eliminate stale-state-related flakiness between runs:

```groovy
pipeline {
    agent any
    options {
        skipDefaultCheckout()
    }
    stages {
        stage('Clean & Checkout') {
            steps {
                cleanWs()
                checkout scm
            }
        }
        stage('Build') {
            steps {
                sh 'make build'
            }
        }
    }
    post {
        always {
            cleanWs()
        }
    }
}
```

Adding diagnostic output and a timeout to make a hanging or unclear failure easier to pin down:

```groovy
pipeline {
    agent any
    options {
        timeout(time: 15, unit: 'MINUTES')
    }
    stages {
        stage('Deploy') {
            steps {
                sh 'set -x; ./deploy.sh'   // -x prints each command before running it
            }
        }
    }
    post {
        failure {
            sh 'env | sort'                 // dump environment for post-mortem inspection
        }
    }
}
```

## Common Pitfalls / Gotchas

- Jumping straight to "the pipeline is broken" without first checking whether the failure is a genuine code/test regression versus an infrastructure/environment issue — they need different fixes and conflating them wastes debugging time.
- Adding `retry()` around an entire pipeline/stage to mask an intermittent failure without ever investigating the root cause, letting real flakiness (a race condition, a resource leak) persist indefinitely.
- Not pinning tool versions (`tools { }`, containerized agents), causing "works on one agent, fails on another" failures that are hard to reproduce because the actual cause is environment drift, not code.
- Forgetting stale workspace state can cause a build to pass or fail differently than a truly clean checkout would — `cleanWs()` or ephemeral agents eliminate this whole class of non-reproducible failures.
- Debugging credential/permission failures by staring at the pipeline logic instead of checking whether the referenced credential ID still exists, hasn't expired, or hasn't had its scope changed.

## Interview Questions & Answers

**Q: A pipeline fails on a specific stage — what's your first step in debugging it?**
A: Read the console output for that build, focusing on the failed stage's exact command and error, since declarative pipeline attributes failures to a specific stage in the graph. Then determine whether it's a genuine code/test regression versus an infrastructure issue (agent problem, network flake, credential/permission error) before deciding on a fix, since those categories require fundamentally different responses.

**Q: A pipeline passes on one agent but consistently fails on another — what would you check?**
A: Tool version differences between the two agents (a different JDK/Node/Maven version installed), leftover workspace state from a previous build on that specific agent, or environment variables/OS differences the pipeline implicitly depends on. Pinning versions via `tools { }` or moving to ephemeral, containerized agents eliminates this entire class of "agent-specific" failure.

**Q: How would you handle a genuinely flaky step (like a network call that occasionally times out) without hiding a real bug?**
A: Wrap just that specific step in `retry(n) { ... }` — not the whole pipeline — so only the actually-flaky operation gets retried, and continue investigating the underlying cause (increase timeout, fix a race condition, add better error handling in the calling code) rather than treating the retry as a permanent fix.

**Q: What is the Replay feature, and why is it useful for debugging?**
A: Replay lets you edit a completed pipeline run's Jenkinsfile and immediately re-run it with the edits, without committing anything to source control. It's useful for quickly iterating on a fix to pipeline logic or syntax without needing a commit-push-wait cycle per attempt.

**Q: A step that authenticates against an external service starts failing with an auth error, and nothing in the Jenkinsfile changed — what would you investigate?**
A: Whether the referenced credential has expired (many tokens have a fixed lifetime), whether the credential ID still points to the intended secret (someone may have rotated or replaced it under the same ID with a different value, or under a different ID), and whether a permission/scope change on the external service itself now rejects a previously-valid credential — the pipeline code being unchanged points strongly at the credential or the external system, not the pipeline logic.

## Related Topics

- [pipeline.md](./pipeline.md)
- [agents-and-executors.md](./agents-and-executors.md)
- [credentials-management.md](./credentials-management.md)
- [parallel-stages.md](./parallel-stages.md)
