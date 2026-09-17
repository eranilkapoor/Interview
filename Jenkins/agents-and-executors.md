# Agents and Executors

Jenkins scales build work through a controller/agent (historically "master/slave") architecture. The **controller** is the central Jenkins process — it serves the web UI, stores configuration, schedules jobs, and coordinates everything, but in a well-designed setup it does not run the actual build steps itself. **Agents** (also called nodes) are separate machines or containers that connect to the controller and execute the actual `sh`/`bat` steps of a build. Each agent exposes one or more **executors** — a slot capable of running one build step sequence at a time — so a single agent with 4 executors can run up to 4 builds (or 4 parallel stages) concurrently.

Agents connect to the controller in one of a few ways: permanently-configured static machines (SSH-launched or with a pre-installed agent JAR), or dynamically provisioned on demand — a Docker container spun up per build, or a Kubernetes pod created by the Kubernetes plugin and torn down when the build finishes. Dynamic agents are the modern default for cloud-native Jenkins setups because they give perfectly clean, reproducible build environments and avoid the "works on this one agent but not that one" drift that accumulates on long-lived static agents.

Agents are typically organized by **labels** — arbitrary tags like `linux`, `docker`, `windows`, or `gpu` — and a pipeline's `agent` directive can request a specific label so the scheduler only places the build on a node that satisfies it. This is how teams support heterogeneous build requirements (different OSes, specialized hardware, isolated network zones) from one Jenkins controller without every job needing to know the concrete hostname of where it runs.

The controller/agent split matters for both security and scale: keeping the controller free of build execution limits the blast radius if a build is compromised or misbehaves (a runaway build process can exhaust an agent's resources without touching the controller's stability), and it lets you add capacity horizontally by adding more agents rather than vertically scaling one machine.

## Examples

Requesting a specific label for an entire pipeline:

```groovy
pipeline {
    agent { label 'linux && docker' }
    stages {
        stage('Build') {
            steps {
                sh 'docker build -t myapp:${BUILD_NUMBER} .'
            }
        }
    }
}
```

Using a different agent per stage — common when the build step and the deploy step need different environments:

```groovy
pipeline {
    agent none
    stages {
        stage('Build') {
            agent { label 'linux' }
            steps { sh 'make build' }
        }
        stage('Deploy to Windows target') {
            agent { label 'windows' }
            steps { bat 'deploy.bat' }
        }
    }
}
```

Provisioning a fully ephemeral agent as a Docker container, with the image itself defining the environment:

```groovy
pipeline {
    agent {
        docker { image 'node:20-alpine' }
    }
    stages {
        stage('Install & Test') {
            steps {
                sh 'npm ci && npm test'
            }
        }
    }
}
```

## Common Pitfalls / Gotchas

- Running builds directly on the controller (`agent any` on a Jenkins instance with no separate agents configured) — couples untrusted build workload to the system that manages credentials and scheduling for everything.
- Assuming a labeled agent request guarantees a specific machine — labels match any node with that label, so builds can land on a different physical/virtual host each run unless the label uniquely identifies one node.
- Leaving static agents long-lived without configuration management, letting installed tool versions drift between agents until "works on agent-3 but fails on agent-7" bugs appear.
- Under-provisioning executors relative to expected concurrent load, causing builds to queue for available executor slots even though the underlying infrastructure has capacity.
- Not cleaning agent workspaces between builds, letting stale files from a previous build leak into a new one and produce non-reproducible results.

## Interview Questions & Answers

**Q: What's the difference between the Jenkins controller and an agent?**
A: The controller is the central process that serves the UI, stores configuration, and schedules work; agents are separate machines/containers that connect to the controller and actually execute build steps. Well-architected Jenkins keeps the controller free of build execution so it stays available and isolated from untrusted build workloads.

**Q: What is an executor, and how does it relate to build concurrency?**
A: An executor is a slot on an agent capable of running one build's steps at a time. An agent with N executors can run up to N builds or parallel stages concurrently; if all executors across all matching agents are busy, further builds queue until one frees up.

**Q: How do labels work, and why use them instead of hardcoding a node name?**
A: Labels are tags (like `linux`, `docker`, `gpu`) attached to agents; a pipeline requests a label rather than a specific hostname, letting the Jenkins scheduler place the build on any currently-available node that satisfies it. This decouples pipelines from specific machines, supports horizontal scaling by just adding more labeled agents, and lets heterogeneous environments (different OSes, hardware) be modeled cleanly.

**Q: What's the advantage of dynamic (e.g., Kubernetes pod) agents over static, always-on agents?**
A: Dynamic agents are provisioned fresh per build and destroyed afterward, guaranteeing a clean, reproducible environment every time and eliminating configuration drift. They also scale to zero when idle, avoiding the cost of always-on capacity, and scale out automatically under load rather than requiring manual agent provisioning.

**Q: A build is stuck in the queue with no available executor — how would you diagnose it?**
A: Check whether any online agent actually matches the requested label; check whether all matching agents' executors are already occupied by other running builds; check whether the agent is offline, disconnected, or failed to provision (common with cloud/Kubernetes agents if the provisioning plugin hit quota or image-pull errors); and check whether the job has a concurrency/throttle restriction holding it back independent of executor availability.

## Related Topics

- [installing-jenkins.md](./installing-jenkins.md)
- [pipeline.md](./pipeline.md)
- [parallel-stages.md](./parallel-stages.md)
- [pipeline-troubleshooting.md](./pipeline-troubleshooting.md)
