# Parallel Stages

By default, Jenkins pipeline stages run sequentially, one after another. The `parallel` directive/step lets multiple stages (or arbitrary blocks of steps) run concurrently instead, each potentially on a different agent, which is one of the most impactful ways to cut pipeline wall-clock time — running independent unit test suites, linting, and a security scan simultaneously instead of back-to-back can turn a 15-minute pipeline into a 5-minute one, since the total time becomes the slowest branch rather than the sum of all branches.

In declarative pipeline, parallel stages are declared with a `parallel { }` block nested inside a `stage`, containing multiple named sub-stages that all start together. Each parallel branch can request its own `agent`, meaning a single pipeline run can simultaneously use a Linux agent for one branch and a Windows agent for another. In scripted pipeline, the equivalent is the `parallel` step taking a map of branch-name-to-closure pairs, executed with the same concurrent semantics.

Parallel branches are independent by default — if one branch fails, the others still run to completion unless `failFast: true` is set on the enclosing `parallel` block, which immediately aborts all other running branches as soon as any one of them fails. This trade-off matters operationally: `failFast` gets you a faster failure signal at the cost of losing the results of branches that were still in progress (e.g., you won't see whether the Windows build also would have failed).

A common real-world pattern is parallelizing test suites by splitting them across branches (e.g., by test file, by browser for cross-browser testing, or by microservice in a monorepo), then aggregating results afterward with a shared `post { }` block that runs regardless of which branch(es) failed.

## Examples

Declarative parallel stages running unit tests, linting, and a security scan concurrently:

```groovy
pipeline {
    agent any
    stages {
        stage('Verify') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'npm test'
                    }
                }
                stage('Lint') {
                    steps {
                        sh 'npm run lint'
                    }
                }
                stage('Security Scan') {
                    steps {
                        sh 'npm audit'
                    }
                }
            }
        }
    }
}
```

Parallel branches each requesting a different agent, plus `failFast` to abort remaining branches on first failure:

```groovy
pipeline {
    agent none
    stages {
        stage('Cross-platform build') {
            parallel {
                stage('Linux') {
                    agent { label 'linux' }
                    steps { sh './build.sh' }
                }
                stage('Windows') {
                    agent { label 'windows' }
                    steps { bat 'build.bat' }
                }
            }
            failFast true
        }
    }
}
```

The scripted-pipeline equivalent, using a Groovy map of branch name to closure:

```groovy
node {
    stage('Verify') {
        parallel(
            'unit-tests': {
                sh 'npm test'
            },
            'lint': {
                sh 'npm run lint'
            },
            'security-scan': {
                sh 'npm audit'
            }
        )
    }
}
```

## Common Pitfalls / Gotchas

- Assuming parallel branches share state (variables, files) automatically — each branch may run on a different agent with a completely separate filesystem; use `stash`/`unstash` or explicit artifact passing to share data across branches.
- Forgetting `failFast` when a fast failure signal matters more than complete results — without it, a pipeline can run for the full duration of the slowest branch even after an earlier branch has already failed.
- Over-parallelizing beyond available executor capacity — declaring 10 parallel branches when only 3 executors are free doesn't run them all at once; the extras just queue, providing no speed benefit and adding scheduling overhead.
- Not aggregating results from all branches in a shared `post { }` block, making it unclear which specific branch(es) failed when only the overall stage shows red.
- Nesting `parallel` blocks with the expectation of independent failure isolation, without accounting for shared resources (e.g., all branches writing to the same external test database) that reintroduce hidden coupling despite looking independent in the pipeline code.

## Interview Questions & Answers

**Q: How do you run stages in parallel in a Jenkins pipeline, and why would you?**
A: Wrap multiple named stages in a `parallel { }` block (declarative) or use the `parallel` step with a map of branch closures (scripted). You'd do this to reduce total pipeline wall-clock time by running independent work — tests, linting, multi-platform builds — concurrently instead of sequentially, since total time becomes bounded by the slowest branch rather than the sum of all branches.

**Q: What does `failFast` do, and what's the trade-off of using it?**
A: `failFast: true` on a `parallel` block immediately aborts all other still-running branches as soon as any one branch fails, giving a faster failure signal. The trade-off is losing visibility into whether the other in-progress branches would also have failed or passed — useful when you just need to know "did anything break" quickly, less useful when you want a complete picture of failures across all branches.

**Q: Can each parallel branch use a different agent? Why would you do that?**
A: Yes — each branch inside a `parallel { }` block can declare its own `agent`, so one branch might build on Linux while another builds on Windows, simultaneously, within the same pipeline run. This is essential for cross-platform builds/tests that genuinely need different operating systems or architectures.

**Q: If parallel branches run on different agents, how do you share data (like a build artifact) between them?**
A: Not automatically — each agent has its own filesystem. Use `stash` in the producing branch and `unstash` in a later stage/branch to explicitly transfer files, or publish/retrieve artifacts through a shared store (artifact repository, S3, etc.) if the data needs to persist beyond the current build.

**Q: What's a risk of adding more parallel branches than your Jenkins setup has executor capacity for?**
A: Branches beyond available executors simply queue rather than truly running concurrently, so you get no wall-clock benefit from those extra branches and add scheduling overhead — the practical parallelism is capped by however many executors across matching agents are actually free at that moment.

## Related Topics

- [pipeline.md](./pipeline.md)
- [declarative-pipeline.md](./declarative-pipeline.md)
- [agents-and-executors.md](./agents-and-executors.md)
- [pipeline-troubleshooting.md](./pipeline-troubleshooting.md)
