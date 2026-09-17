# Declarative Pipeline

Declarative Pipeline is the modern, recommended syntax for writing a Jenkinsfile. It wraps pipeline definitions in a fixed, structured grammar starting with a top-level `pipeline { }` block containing a predefined set of sections — `agent`, `environment`, `options`, `parameters`, `stages`, `post`, and `triggers` — each with a specific, validated purpose. Because the structure is fixed and known ahead of time, Jenkins can validate a declarative pipeline's syntax before running it (catching typos and structural mistakes immediately), render a richer visualization in the UI (Blue Ocean and the classic stage view both understand declarative structure natively), and let newcomers write correct pipelines without needing to know Groovy as a general-purpose language.

The trade-off for that structure is reduced flexibility: declarative pipelines can't contain arbitrary imperative Groovy directly inside `stages` — loops, complex conditionals, and custom logic have to be wrapped in a `script { }` step, which drops back into scripted-pipeline semantics for just that block. In practice, the vast majority of real pipelines are pure declarative with at most a small `script { }` block for one genuinely dynamic piece of logic (e.g., computing a version string, deciding a deploy target based on branch name).

Declarative pipelines require exactly one top-level `agent` directive (which can be `any`, `none` — deferring to per-stage agents — or a specific label/Docker image), and every stage inside `stages { }` must itself define at least one `steps { }` block (or delegate to `parallel`/nested stages). This rigidity is deliberate: it's what lets Jenkins statically understand the pipeline's shape.

Conditional execution in declarative pipelines is handled by the `when { }` directive rather than raw `if` statements — `when { branch 'main' }`, `when { expression { ... } }`, and similar conditions gate whether a stage runs at all, keeping conditional logic declarative and inspectable rather than buried in imperative code.

## Examples

A declarative pipeline using `when` to conditionally run a deploy stage only on the main branch:

```groovy
pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                sh 'npm install && npm run build'
            }
        }
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh './deploy.sh production'
            }
        }
    }
}
```

Declaring parameters and environment variables, both distinctly declarative-syntax sections:

```groovy
pipeline {
    agent any
    parameters {
        choice(name: 'ENVIRONMENT', choices: ['staging', 'production'], description: 'Target environment')
        booleanParam(name: 'SKIP_TESTS', defaultValue: false, description: 'Skip test stage')
    }
    environment {
        API_URL = 'https://api.example.com'
        DEPLOY_TOKEN = credentials('deploy-token-id')
    }
    stages {
        stage('Deploy') {
            steps {
                sh "curl -H 'Authorization: Bearer $DEPLOY_TOKEN' $API_URL/deploy?env=${params.ENVIRONMENT}"
            }
        }
    }
}
```

Dropping into a `script { }` block for logic that declarative syntax alone can't express — here, computing a dynamic tag:

```groovy
pipeline {
    agent any
    stages {
        stage('Tag & Build') {
            steps {
                script {
                    def tag = "${env.BRANCH_NAME}-${env.BUILD_NUMBER}"
                    sh "docker build -t myapp:${tag} ."
                }
            }
        }
    }
}
```

## Common Pitfalls / Gotchas

- Forgetting that every declarative pipeline requires exactly one top-level `agent` — omitting it (or writing `agent none` without per-stage agents) causes a validation error or stages that never get scheduled.
- Writing raw Groovy loops/conditionals directly inside a `steps { }` block — declarative requires wrapping such logic in `script { }`; the parser rejects bare imperative code outside it.
- Overusing `script { }` blocks until the "declarative" pipeline is mostly scripted code wearing a declarative wrapper, losing the validation and visualization benefits declarative exists to provide.
- Misunderstanding `when { }` evaluation timing — by default `when` conditions are evaluated before entering the stage's agent, but some conditions (like `expression` referencing stage-local state) need `beforeAgent`/`beforeInput` options tuned explicitly to behave as expected.
- Putting secrets directly as string literals in `environment { }` instead of using `credentials('id')`, which both hides the secret from the Jenkinsfile source and gets it automatically masked in console logs.

## Interview Questions & Answers

**Q: What is declarative pipeline syntax, and why is it recommended over scripted?**
A: It's a structured Jenkinsfile format built around a fixed `pipeline { }` block with predefined sections (`agent`, `stages`, `post`, etc.). It's recommended because its fixed structure lets Jenkins validate syntax up front, render richer UI visualizations, and is far easier to read/write for people who aren't fluent in Groovy — covering the large majority of real-world pipeline needs without sacrificing much.

**Q: How do you handle logic in declarative pipeline that isn't expressible in the fixed grammar (loops, complex conditionals)?**
A: Wrap that specific logic in a `script { }` step inside `steps { }`. Inside `script { }`, full scripted-pipeline (arbitrary Groovy) semantics apply, letting you drop into imperative code for just that piece while the rest of the pipeline stays declarative.

**Q: What does the `when` directive do, and how does it differ from just writing `if` inside a step?**
A: `when { }` conditionally controls whether an entire stage executes, evaluated declaratively (branch name, environment variable value, expression, changeset, etc.) before the stage's steps run. It keeps conditional flow visible and structured at the pipeline level, versus burying an `if` inside a step where Jenkins's stage visualization can't reflect the branching.

**Q: What are the required top-level sections of a declarative `pipeline { }` block?**
A: `agent` and `stages` are required; `environment`, `parameters`, `options`, `triggers`, `tools`, and `post` are optional but commonly used. Every stage inside `stages` must itself contain `steps` (or `parallel`/nested `stages`).

**Q: How would you conditionally deploy only from the `main` branch in a declarative pipeline?**
A: Add a `when { branch 'main' }` directive to the deploy stage, so Jenkins only executes that stage's steps when the pipeline is running against the `main` branch — commonly combined with a Multibranch Pipeline job so the same Jenkinsfile runs (with different stage behavior) across all branches.

## Related Topics

- [scripted-pipeline.md](./scripted-pipeline.md)
- [pipeline.md](./pipeline.md)
- [jenkinsfile.md](./jenkinsfile.md)
- [parallel-stages.md](./parallel-stages.md)
