# Introduction to Jenkins

Jenkins is an open-source automation server used to build, test, and deploy software continuously. It grew out of the Hudson project (forked in 2011 after an Oracle trademark dispute) and remains one of the most widely deployed CI/CD tools because it is free, self-hosted, and extensible through a huge plugin ecosystem rather than locked into one cloud vendor's workflow syntax. At its core, Jenkins does one thing: it watches for a trigger (a code push, a schedule, a manual click, an upstream job finishing) and then runs a defined sequence of steps — compiling code, running tests, building artifacts, deploying to an environment — recording the result and notifying whoever needs to know.

The term "continuous integration" describes the practice Jenkins was originally built to support: every time a developer pushes code, an automated build verifies it still compiles and passes tests, catching integration problems within minutes instead of days. Jenkins later grew "continuous delivery/deployment" capabilities on top of that — the same pipeline that builds and tests can also push the resulting artifact through staging and into production, either requiring a manual approval gate (continuous delivery) or fully automatically (continuous deployment). This is why Jenkins pipelines are almost always described as "build, test, deploy" rather than just "build."

Jenkins runs as a Java application (traditionally deployed as a WAR file inside a servlet container, more commonly today as a Docker container or a native package with an embedded Jetty server). It exposes a web UI and a REST/CLI API, stores its configuration on disk under `JENKINS_HOME`, and delegates almost every specific capability — Git integration, Slack notifications, Kubernetes agent provisioning, static analysis, security scanning — to plugins rather than baking them into the core. This plugin-first architecture is both Jenkins's greatest strength (nearly anything can be integrated) and its most common operational pain point (plugin version compatibility, security patching, and configuration drift across large installations).

Unlike newer CI platforms that are inherently hosted (GitHub Actions, CircleCI, GitLab CI as a SaaS offering), Jenkins is self-managed by default: you own the server, the scaling, the security patching, and the backups. This makes it a common choice for organizations with strict data-residency or network-isolation requirements, on-prem infrastructure, or highly customized build environments, and a less common choice for small teams who would rather not operate infrastructure at all.

## Examples

Minimal declarative Jenkinsfile — the standard entry point for understanding "what does a Jenkins pipeline look like":

```groovy
pipeline {
    agent any
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
}
```

Running Jenkins locally via Docker (the fastest way to get a real instance to experiment with):

```bash
docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  jenkins/jenkins:lts-jdk17
```

Checking the initial admin password Jenkins generates on first boot, and the CLI equivalent of triggering a job once it's configured:

```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword

java -jar jenkins-cli.jar -s http://localhost:8080/ build my-pipeline-job -f
```

## Common Pitfalls / Gotchas

- Treating Jenkins as "just a UI to click buttons in" instead of adopting Jenkinsfile-as-code — configuration that lives only in the web UI isn't versioned, isn't reviewable, and disappears if the job is deleted.
- Letting the plugin set sprawl unmanaged — every plugin is a potential security surface and a potential upgrade blocker; audit and prune plugins you don't actually use.
- Running all builds on the Jenkins controller itself instead of dedicated agents, which couples build workload to the availability and security of the one system that manages everything else.
- Assuming Jenkins requires a huge upfront investment to start with — a working pipeline can be a single-node Docker container and a 15-line Jenkinsfile; complexity should be added as real needs (scale, security, multi-team) appear, not up front.

## Interview Questions & Answers

**Q: What is Jenkins, in one sentence, and what problem does it solve?**
A: Jenkins is a self-hosted, open-source automation server that runs defined sequences of build/test/deploy steps in response to triggers like code pushes, solving the problem of manually and inconsistently building, testing, and releasing software.

**Q: How does Jenkins differ from hosted CI platforms like GitHub Actions or CircleCI?**
A: Jenkins is self-managed — you provision, scale, secure, and patch the server yourself — versus SaaS platforms that run entirely on the vendor's infrastructure. This gives Jenkins more flexibility (on-prem deployment, arbitrary plugin integrations, full control over agents) at the cost of operational overhead that hosted platforms absorb for you.

**Q: What is the relationship between Jenkins and the plugin ecosystem?**
A: Jenkins's core is intentionally minimal; nearly all specific functionality (Git, Docker, Kubernetes, Slack, static analysis, credentials backends) is delivered through plugins. This makes Jenkins extremely extensible but also means real-world Jenkins operation includes ongoing plugin version management and security patching.

**Q: What's the difference between continuous integration, continuous delivery, and continuous deployment, and how does Jenkins support each?**
A: CI is automatically building/testing every change. Continuous delivery extends that pipeline to produce a release-ready artifact and push it through staging, typically gated by a manual approval before production. Continuous deployment removes that manual gate and deploys automatically once all pipeline stages pass. Jenkins pipelines can implement any of the three — the difference is purely how many stages exist after the tests pass and whether an `input` step pauses for approval.

## Related Topics

- [installing-jenkins.md](./installing-jenkins.md)
- [jenkinsfile.md](./jenkinsfile.md)
- [pipeline.md](./pipeline.md)
- [using-jenkins.md](./using-jenkins.md)
- [agents-and-executors.md](./agents-and-executors.md)
