# Jenkinsfile

A Jenkinsfile is a text file, checked into source control alongside the application code, that defines a Jenkins pipeline as code. Rather than configuring build steps by clicking through the Jenkins web UI (where the definition lives only inside Jenkins's own state and isn't versioned, reviewed, or reproducible), a Jenkinsfile makes the entire build/test/deploy process a first-class part of the repository — it gets code review in pull requests, travels with branches, and can be diffed and rolled back like any other source file. This is the foundation of the "pipeline as code" practice that essentially all modern Jenkins usage is built on.

A Jenkinsfile is written in Groovy and can use either of two syntaxes: **declarative** (a structured, opinionated format built around a top-level `pipeline { }` block with fixed sections like `agent`, `stages`, `post`) or **scripted** (arbitrary Groovy code wrapped in a `node { }` block, giving full programming-language flexibility at the cost of more boilerplate and a steeper learning curve). Declarative is the modern default recommended by Jenkins documentation for the vast majority of use cases; scripted remains available and is occasionally mixed in via the declarative `script { }` step when a specific piece of logic genuinely needs full Groovy control flow.

Jenkins discovers a Jenkinsfile automatically when a job is configured as "Pipeline from SCM" (or via Multibranch Pipeline / Organization Folder jobs, which scan a repository's branches and automatically create a pipeline job per branch that contains a Jenkinsfile). This is what enables Jenkins to run a different pipeline per branch or pull request without any manual per-branch job configuration — push a branch with a Jenkinsfile, and Jenkins picks it up.

Because the Jenkinsfile is just Groovy running inside the pipeline plugin's DSL, it can reference environment variables, call shared libraries (reusable pipeline code extracted into a separate versioned repository), and use `credentials()` bindings — all without ever hardcoding secrets or environment-specific values directly in the file.

## Examples

A realistic three-stage declarative Jenkinsfile for a Node.js application:

```groovy
pipeline {
    agent any
    environment {
        NODE_ENV = 'test'
    }
    stages {
        stage('Build') {
            steps {
                sh 'npm install'
            }
        }
        stage('Test') {
            steps {
                sh 'npm test'
            }
        }
        stage('Deploy') {
            steps {
                sh './deploy.sh'
            }
        }
    }
    post {
        always {
            junit 'reports/**/*.xml'
        }
        failure {
            mail to: 'team@example.com', subject: "Build failed: ${env.JOB_NAME}"
        }
    }
}
```

Calling a shared library function from a Jenkinsfile — a common pattern once multiple repositories need the same pipeline logic:

```groovy
@Library('my-shared-library') _

pipeline {
    agent any
    stages {
        stage('Build & Publish') {
            steps {
                buildAndPublish(artifactName: 'my-service')
            }
        }
    }
}
```

Configuring a Multibranch Pipeline job via the CLI/config XML so Jenkins auto-discovers the Jenkinsfile per branch (conceptually — most teams do this through "New Item > Multibranch Pipeline" in the UI, pointing at the repo URL):

```groovy
// Jenkinsfile at repo root — Jenkins finds this automatically for every
// branch/PR once the job is configured as Multibranch Pipeline
pipeline {
    agent any
    stages {
        stage('Build') {
            steps { sh 'make' }
        }
    }
}
```

## Common Pitfalls / Gotchas

- Editing the pipeline definition only through the Jenkins UI instead of committing it as a Jenkinsfile — loses version control, code review, and the ability to reproduce the exact pipeline that ran for a given commit.
- Hardcoding secrets, hostnames, or environment-specific values directly in the Jenkinsfile instead of using `credentials()` bindings and parameters.
- Writing large amounts of duplicated logic across many repositories' Jenkinsfiles instead of extracting shared steps into a Shared Library.
- Forgetting that a Jenkinsfile in a branch only takes effect for jobs configured to read from that branch (Multibranch Pipeline) — a single "Pipeline" job type reads from one fixed branch/ref unless explicitly reconfigured.
- Mixing declarative and scripted syntax incorrectly — scripted code is only valid declaratively inside a `script { }` step; pasting raw scripted syntax into a declarative `pipeline { }` block causes a parse error.

## Interview Questions & Answers

**Q: What is a Jenkinsfile, and why is it preferred over configuring jobs through the UI?**
A: A Jenkinsfile is a text file defining a Jenkins pipeline as code, checked into the same repository as the application. It's preferred because it's versioned, reviewable in pull requests, reproducible per commit/branch, and travels with the code — UI-only configuration lives solely in Jenkins's internal state and has none of those properties.

**Q: What are the two Jenkinsfile syntaxes, and how do you decide which to use?**
A: Declarative, a structured format built around a fixed `pipeline { }` block with defined sections (`agent`, `stages`, `post`, etc.), and scripted, arbitrary Groovy wrapped in `node { }`. Declarative is the modern default — easier to read, validate, and maintain — and is recommended for nearly all pipelines; scripted (or a declarative `script { }` step) is reserved for cases needing genuinely dynamic control flow that declarative's structure can't express cleanly.

**Q: How does Jenkins discover and run a Jenkinsfile automatically per branch?**
A: Through a Multibranch Pipeline (or Organization Folder) job type, which periodically scans a repository's branches and pull requests, automatically creating/removing a pipeline job for each one that contains a Jenkinsfile — no manual per-branch job setup needed.

**Q: What is a Shared Library, and what problem does it solve?**
A: A Shared Library is a separate, versioned Groovy repository containing reusable pipeline steps/functions that multiple Jenkinsfiles can import via `@Library('name') _`. It solves the problem of duplicating the same build/deploy logic across many repositories' Jenkinsfiles — common steps live in one place and get updated once.

**Q: How do you keep secrets out of a Jenkinsfile while still using them in build steps?**
A: Store secrets in the Jenkins credentials store and reference them by ID — either via the `credentials()` helper in an `environment { }` block, or with a `withCredentials([...])` step — so the Jenkinsfile only ever contains a credential ID, never the actual secret value, and Jenkins masks the secret in console output.

## Related Topics

- [declarative-pipeline.md](./declarative-pipeline.md)
- [scripted-pipeline.md](./scripted-pipeline.md)
- [pipeline.md](./pipeline.md)
- [credentials-management.md](./credentials-management.md)
