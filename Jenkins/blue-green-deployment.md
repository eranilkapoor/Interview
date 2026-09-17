# Blue-Green Deployment

Blue-green deployment is a release strategy that eliminates downtime and reduces deployment risk by running two identical production environments — conventionally named "blue" (currently live) and "green" (the new version being deployed) — and switching traffic from one to the other only after the new version is verified healthy. Instead of updating a live environment in place (where a bad deploy means users hit broken code until it's rolled back), you deploy the new version entirely to the idle environment, run smoke tests/health checks against it while it receives zero production traffic, and then flip a router, load balancer, or DNS record to point traffic at it. If something's wrong, rolling back is just flipping traffic back to the still-intact previous environment — fast, and without needing to redeploy anything.

Jenkins doesn't implement blue-green deployment itself — it's an infrastructure/traffic-routing pattern — but a Jenkins pipeline is a natural place to orchestrate it, since the pattern is fundamentally a sequence of discrete, scriptable steps: deploy to the idle environment, run verification, then either flip traffic (with pipeline `input` gates commonly used for a manual go/no-go decision) or automatically roll back if verification fails. This is a frequently asked interview scenario specifically because it combines several Jenkins concepts — stages, conditional logic, credentials for infrastructure APIs, and manual approval gates — into one coherent real-world workflow.

The core trade-off of blue-green is cost and complexity versus safety: you need double the production infrastructure (or a fast way to provision the idle environment on demand), and any state that isn't cleanly shared between environments (databases, in-flight sessions, caches) needs careful handling — a naive blue-green switch on a stateful service can lose or duplicate data unless the data layer is either shared between both environments or migrated compatibly. This is why blue-green is most straightforward for stateless services behind a load balancer, and considerably more involved for anything with its own persistent state.

Canary deployment is a related but distinct strategy often discussed alongside blue-green in interviews: rather than an instant all-or-nothing traffic switch, canary gradually shifts a small percentage of traffic to the new version, increasing it over time while monitoring for errors — trading a slower rollout for a smaller blast radius if something is wrong, versus blue-green's fast, complete switch with a fast, complete rollback.

## Examples

A declarative pipeline orchestrating a blue-green deploy against two environments, with a manual approval gate before flipping traffic:

```groovy
pipeline {
    agent any
    parameters {
        choice(name: 'ACTIVE_ENV', choices: ['blue', 'green'], description: 'Currently live environment')
    }
    stages {
        stage('Determine idle environment') {
            steps {
                script {
                    env.IDLE_ENV = (params.ACTIVE_ENV == 'blue') ? 'green' : 'blue'
                }
            }
        }
        stage('Deploy to idle environment') {
            steps {
                sh "./deploy.sh ${env.IDLE_ENV}"
            }
        }
        stage('Smoke test idle environment') {
            steps {
                sh "./smoke-test.sh https://${env.IDLE_ENV}.internal.example.com"
            }
        }
        stage('Approve traffic switch') {
            steps {
                input message: "Switch live traffic from ${params.ACTIVE_ENV} to ${env.IDLE_ENV}?"
            }
        }
        stage('Switch traffic') {
            steps {
                sh "./switch-router.sh ${env.IDLE_ENV}"
            }
        }
    }
    post {
        failure {
            echo "Blue-green deploy failed before traffic switch — ${params.ACTIVE_ENV} remains live, no rollback needed."
        }
    }
}
```

Rolling back by simply flipping the router back to the previous environment — the key operational benefit of blue-green:

```groovy
stage('Rollback') {
    steps {
        sh "./switch-router.sh ${params.ACTIVE_ENV}"   // point back at the environment that was live before
    }
}
```

Using AWS as a concrete example — switching an Application Load Balancer's target group to implement the traffic flip:

```bash
aws elbv2 modify-listener \
  --listener-arn arn:aws:elasticloadbalancing:...:listener/app/my-alb/... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/green-tg/...
```

## Common Pitfalls / Gotchas

- Treating blue-green as automatically safe for stateful services — a database or cache not shared/migrated compatibly between blue and green can lose or duplicate data across the switch.
- Skipping real verification (smoke tests/health checks) on the idle environment before flipping traffic, turning blue-green into "deploy blind and hope," which defeats its main safety benefit.
- Letting the idle environment drift out of sync with the live one between deploys (different config, different data), so it's no longer truly a safe rollback target if something goes wrong.
- Forgetting to actually decommission or reset the now-idle environment after a successful switch, silently doubling infrastructure cost indefinitely.
- Confusing blue-green with canary deployment in an interview answer — they solve a similar problem (safe releases) with very different mechanisms (instant full switch with fast rollback vs. gradual percentage-based traffic shifting).

## Interview Questions & Answers

**Q: What is blue-green deployment, and what problem does it solve?**
A: It's a release strategy running two identical production environments, deploying the new version to the currently-idle one, verifying it, then switching live traffic to it via a router/load balancer/DNS flip. It solves the downtime and risk of in-place deployment — since the new version only receives traffic after being verified healthy, and rollback is just flipping traffic back to the untouched previous environment rather than re-deploying.

**Q: How would you orchestrate blue-green deployment in a Jenkins pipeline?**
A: As a sequence of stages: determine which environment is currently idle, deploy the new version to it, run smoke tests/health checks against it while it's still receiving no production traffic, optionally gate the switch behind a manual `input` approval, then flip the router/load balancer to send traffic to the newly-verified environment. Rollback is a separate, much simpler stage that just flips the router back.

**Q: What's the main risk or complexity blue-green introduces for services with persistent state?**
A: If the database or other persistent state isn't shared or compatibly migrated between the blue and green environments, switching traffic can point users at data that's stale, missing, or duplicated relative to what they last saw — the pattern is straightforward for stateless services but requires careful data-layer design for anything with meaningful state.

**Q: How does blue-green deployment differ from canary deployment?**
A: Blue-green does an instant, complete traffic switch from one full environment to another, with equally fast, complete rollback. Canary gradually shifts a small, increasing percentage of traffic to the new version while monitoring for problems, trading a slower rollout for a smaller blast radius if something's wrong — it doesn't require a full duplicate environment, but detecting and stopping a bad canary rollout in time is its own operational challenge.

**Q: Why is blue-green often implemented with a manual approval gate in the pipeline rather than fully automatic?**
A: Because the traffic switch is the point of highest customer impact — automated smoke tests catch obvious breakage, but a human review (checking dashboards, sanity-checking key metrics) before committing full production traffic adds a layer of judgment automated checks can't fully replace, especially for high-stakes releases. Jenkins's `input` step is a natural fit for exactly this kind of go/no-go gate.

## Related Topics

- [pipeline.md](./pipeline.md)
- [credentials-management.md](./credentials-management.md)
- [agents-and-executors.md](./agents-and-executors.md)
- [pipeline-troubleshooting.md](./pipeline-troubleshooting.md)
