# Credentials Management

Jenkins pipelines routinely need secrets — Git deploy keys, Docker registry passwords, cloud provider API tokens, database connection strings — to do their job, and the entire point of Jenkins's built-in **Credentials** system is to let pipelines use those secrets without ever exposing the plaintext value in a Jenkinsfile, in source control, or (as much as possible) in console output. Credentials are created and stored centrally (Manage Jenkins > Credentials), each with a unique ID, and referenced from pipelines only by that ID — the Jenkinsfile itself never contains the actual secret value.

Jenkins supports several credential types out of the box: **Secret text** (a single opaque string, like an API token), **Username with password**, **SSH Username with private key**, **Secret file** (an uploaded file, like a service account JSON key), and **Certificate**. Credentials can be scoped globally or to a specific folder, limiting which jobs can even see (let alone use) a given credential — an important access-control boundary in a multi-team Jenkins instance.

There are two main ways to consume a credential inside a pipeline: the `credentials()` helper inside an `environment { }` block (declarative), which binds the credential's value to an environment variable for the duration of the stage/pipeline, and the `withCredentials([...])` step, which explicitly binds one or more credentials to variables for the duration of a wrapped block of steps. Jenkins automatically masks known credential values in console output (replacing them with `****`) wherever it can detect them being printed, though this masking isn't foolproof — a credential value that gets transformed (base64-encoded, concatenated into a larger string) before being printed can bypass the masking and leak.

For larger organizations, Jenkins's built-in credentials store is often paired with (or replaced by) an external secrets manager — HashiCorp Vault, AWS Secrets Manager, Azure Key Vault — via a plugin, so secrets have a single source of truth, centralized rotation, and audit logging outside of Jenkins's own storage, with Jenkins fetching them at build time rather than holding a long-lived copy.

## Examples

Binding a secret text credential via `environment { }` in a declarative pipeline:

```groovy
pipeline {
    agent any
    environment {
        DEPLOY_TOKEN = credentials('deploy-token-id')
    }
    stages {
        stage('Deploy') {
            steps {
                sh 'curl -H "Authorization: Bearer $DEPLOY_TOKEN" https://api.example.com/deploy'
            }
        }
    }
}
```

Using `withCredentials` to bind a username/password credential pair to variables for one block of steps:

```groovy
pipeline {
    agent any
    stages {
        stage('Push Docker Image') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-hub-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin'
                    sh 'docker push myorg/myapp:latest'
                }
            }
        }
    }
}
```

Using an SSH private key credential for a Git operation that needs deploy-key access:

```groovy
pipeline {
    agent any
    stages {
        stage('Push tag to repo') {
            steps {
                sshagent(credentials: ['git-deploy-key-id']) {
                    sh 'git push origin v1.2.3'
                }
            }
        }
    }
}
```

## Common Pitfalls / Gotchas

- Hardcoding secret values directly in a Jenkinsfile or in job configuration instead of the credentials store — defeats the entire point and permanently leaks the secret into source control history.
- Assuming Jenkins's console masking catches every leak — a credential that's transformed (base64-encoded, embedded in a larger interpolated string, echoed via an unexpected tool) before printing can bypass masking and appear in plaintext in build logs.
- Scoping a credential globally when it should be folder/job-restricted, letting unrelated teams' jobs access a secret they have no legitimate need for.
- Forgetting that `withCredentials` only masks/scopes the variable for the duration of its block — using the credential outside that block (e.g., assigning it to a global variable) can leak it into unrelated later steps or logs.
- Not rotating long-lived credentials (especially static tokens/passwords) regularly, and not auditing which jobs actually still use a given credential before assuming it's safe to remove.

## Interview Questions & Answers

**Q: How does Jenkins let a pipeline use a secret without exposing it in the Jenkinsfile?**
A: Secrets are stored centrally in the Jenkins credentials store, each with a unique ID. The Jenkinsfile references only that ID — via `credentials()` in an `environment` block or the `withCredentials([...])` step — and Jenkins injects the actual value into the build environment at runtime, never writing the plaintext value into the Jenkinsfile itself.

**Q: What credential types does Jenkins support, and when would you use each?**
A: Secret text (single opaque tokens/API keys), Username with password, SSH Username with private key (Git/SSH operations), Secret file (uploaded files like service account JSON), and Certificate. You pick the type matching what the target system actually needs to authenticate — an SSH deploy key for Git push access, username/password for a Docker registry login, etc.

**Q: What's the difference between using `credentials()` in an `environment` block versus `withCredentials`?**
A: `credentials()` in `environment { }` binds a credential to an environment variable for the whole pipeline or stage it's declared in. `withCredentials([...])` explicitly scopes one or more credential bindings to just the steps inside its block, which is generally preferred for tighter scoping — the credential is only available (and only masked/relevant) within that specific block.

**Q: How reliable is Jenkins's automatic masking of secrets in console output, and what's a way it can fail?**
A: It's not foolproof — Jenkins masks exact known credential string matches in output, but if a credential is transformed before being printed (base64-encoded, concatenated with other text, passed through a tool that reformats it), the masking can miss it and the secret leaks in plaintext into build logs, which are often more widely readable than the credentials store itself.

**Q: Why would an organization pair Jenkins's built-in credentials store with an external secrets manager like Vault?**
A: For a single source of truth across all systems (not just Jenkins), centralized rotation and audit logging, and to avoid Jenkins holding long-lived copies of sensitive secrets — Jenkins instead fetches short-lived credentials at build time via a plugin, reducing the blast radius if the Jenkins instance itself is ever compromised.

## Related Topics

- [jenkinsfile.md](./jenkinsfile.md)
- [agents-and-executors.md](./agents-and-executors.md)
- [installing-jenkins.md](./installing-jenkins.md)
- [blue-green-deployment.md](./blue-green-deployment.md)
