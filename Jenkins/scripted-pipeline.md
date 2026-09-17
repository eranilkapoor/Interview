# Scripted Pipeline

Scripted Pipeline is Jenkins's original pipeline-as-code syntax, predating declarative pipeline. It is written as arbitrary Groovy code inside a top-level `node { }` block, giving full access to Groovy's control flow — `if`/`else`, `for`/`while` loops, `try`/`catch`, custom functions and classes — directly in the pipeline body, with no restrictions on structure. Stages are still expressed with a `stage('name') { ... }` block for UI visualization purposes, but nothing about the file's shape is validated or constrained the way declarative pipelines are.

This flexibility is exactly what makes scripted pipeline both powerful and harder to maintain: because it's just Groovy, there's no upfront structural validation, error messages can be less clear, and two scripted pipelines can look completely different from each other in ways that make a team's pipelines inconsistent and harder to review at a glance. Declarative pipeline was introduced specifically to constrain that flexibility into a predictable, validated shape for the common case, while still allowing scripted-style code inside a `script { }` block when genuinely needed.

Scripted pipeline remains fully supported and is not deprecated — it's the right tool when a pipeline's logic is inherently dynamic or complex enough that declarative's fixed grammar would require an unreasonable number of `script { }` escape hatches to express. Shared Library implementations, in particular, are frequently written in scripted style even when the Jenkinsfiles that call them are declarative, since library code is Groovy regardless.

Understanding scripted pipeline is also what makes the declarative `script { }` step make sense: that step is literally scripted-pipeline semantics dropped inline into a declarative pipeline, executing as regular Groovy with full access to the same steps (`sh`, `checkout`, etc.) available anywhere else.

## Examples

A basic scripted pipeline, structurally equivalent to a simple declarative build/test/deploy pipeline:

```groovy
node {
    stage('Build') {
        sh 'npm install'
    }
    stage('Test') {
        sh 'npm test'
    }
    stage('Deploy') {
        sh './deploy.sh'
    }
}
```

Using genuine Groovy control flow — a `for` loop and conditional — that would require a `script { }` escape hatch in declarative syntax:

```groovy
node {
    def environments = ['staging', 'qa', 'prod']

    for (env in environments) {
        stage("Deploy to ${env}") {
            if (env == 'prod') {
                input message: "Approve deploy to ${env}?"
            }
            sh "./deploy.sh ${env}"
        }
    }
}
```

Wrapping build steps in `try`/`catch`/`finally` for custom error handling and guaranteed cleanup — native Groovy exception handling:

```groovy
node {
    try {
        stage('Build') {
            sh 'make build'
        }
        stage('Test') {
            sh 'make test'
        }
    } catch (err) {
        currentBuild.result = 'FAILURE'
        echo "Pipeline failed: ${err}"
        throw err
    } finally {
        stage('Cleanup') {
            sh 'make clean'
            junit 'reports/*.xml'
        }
    }
}
```

## Common Pitfalls / Gotchas

- Assuming scripted pipeline is deprecated or "the old way to avoid" — it's fully supported and is the correct choice for genuinely dynamic pipeline logic; declarative's `script { }` step is itself scripted pipeline running inline.
- Writing inconsistent, ad-hoc structure across a team's scripted pipelines since nothing enforces a shape — leads to pipelines that are hard to review because every one is organized differently.
- Forgetting that stages in scripted pipeline are not validated the way declarative stages are — a typo in a stage name or a missing `stage()` wrapper around some steps doesn't produce a clear validation error, just an incorrect-looking pipeline graph.
- Not handling exceptions explicitly — an unhandled error inside `node { }` fails the whole build, but without `try`/`catch`/`finally`, there's no guaranteed cleanup step (declarative's `post { always { } }` has no direct scripted equivalent unless you write the `try/finally` yourself).
- Overusing scripted pipeline for logic that declarative's `when`/`parameters`/`environment` directives could express more clearly and safely.

## Interview Questions & Answers

**Q: What is scripted pipeline, and how does it differ structurally from declarative?**
A: Scripted pipeline is arbitrary Groovy code inside a `node { }` block with `stage()` calls for visualization, with no fixed grammar or upfront validation. Declarative wraps pipelines in a fixed, validated `pipeline { }` structure with defined sections (`agent`, `stages`, `post`, etc.) and only allows raw Groovy inside an explicit `script { }` step.

**Q: Is scripted pipeline deprecated? When would you actually choose it over declarative?**
A: No, it's fully supported. You'd choose it (or use a `script { }` block within a declarative pipeline) when the pipeline's logic is genuinely dynamic — building stage lists from data, complex branching that `when` can't express cleanly, or custom Groovy classes/functions — situations where forcing declarative's fixed grammar would need excessive escape hatches.

**Q: How does error handling differ between scripted and declarative pipeline?**
A: Scripted pipeline uses native Groovy `try`/`catch`/`finally` around stages, giving full control but requiring the author to write that structure explicitly for any cleanup guarantee. Declarative provides a built-in `post { }` section (`always`, `failure`, `success`, etc.) that runs automatically after all stages regardless of outcome, without needing manual `try`/`finally`.

**Q: What is the relationship between a declarative pipeline's `script { }` step and scripted pipeline?**
A: They're the same thing — `script { }` is a declarative step that executes its contents as scripted-pipeline Groovy, with access to the same steps and full imperative control flow. It's the officially sanctioned way to drop into scripted semantics for a small piece of logic while keeping the rest of the pipeline declarative.

**Q: Why might a team standardize on declarative pipeline even though scripted is more powerful?**
A: Consistency and maintainability at scale — declarative's fixed structure means every pipeline in the org looks similar, gets the same upfront syntax validation, and renders correctly in Blue Ocean/stage view without special cases. The extra power of scripted is rarely needed for typical build/test/deploy flows, so most teams trade a small amount of flexibility for a large amount of predictability.

## Related Topics

- [declarative-pipeline.md](./declarative-pipeline.md)
- [pipeline.md](./pipeline.md)
- [jenkinsfile.md](./jenkinsfile.md)
- [pipeline-troubleshooting.md](./pipeline-troubleshooting.md)
