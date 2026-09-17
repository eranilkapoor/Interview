# Webhooks (Build Triggers)

A pipeline has to start somehow, and Jenkins supports several distinct trigger mechanisms for that, the most important being **webhooks**, **polling**, and **cron-style scheduling**. A webhook is an HTTP callback: the source control host (GitHub, GitLab, Bitbucket) is configured to send a POST request to a Jenkins endpoint (e.g., `/github-webhook/`) every time a relevant event happens — a push, a new pull request, a comment — and Jenkins reacts immediately by starting (or re-scanning, for Multibranch Pipeline) the corresponding job. This is the modern default for triggering builds because it's near-instant and doesn't waste any resources checking for changes that haven't happened.

**Polling** (`pollSCM` in Jenkinsfile terms, or the "Poll SCM" trigger in job configuration) is the older alternative: Jenkins periodically checks the source repository on a cron-like schedule (e.g., every 5 minutes) to see if anything changed, and only starts a build if it finds new commits. Polling works without any network path from the SCM host back into Jenkins (useful when Jenkins is behind a firewall a webhook can't reach), but it's inherently less responsive (there's always a delay up to the polling interval) and wastes cycles checking when nothing changed.

**Cron triggers** (`triggers { cron('H 2 * * *') }`) run a pipeline on a fixed schedule regardless of whether anything changed — nightly builds, weekly dependency-update jobs, periodic cleanup tasks. The `H` symbol in Jenkins cron syntax (hash) deliberately spreads out scheduled jobs across their valid time window rather than firing every job at exactly the same second, avoiding a thundering-herd effect when many jobs share the same nominal schedule.

Beyond these three, Jenkins also supports **upstream/downstream triggers** (one job starting another on completion, the pre-Pipeline pattern for chaining work) and manual triggers (someone clicking "Build Now" or hitting the REST API/CLI directly). For webhook-based triggers to work reliably with Multibranch Pipeline jobs, the SCM webhook needs to notify Jenkins about branch/PR-level events specifically (not just pushes to one branch), which most SCM webhook integrations (and their corresponding Jenkins plugins — GitHub Branch Source, GitLab plugin, etc.) support directly.

## Examples

Configuring a declarative pipeline to poll SCM every 5 minutes, useful when Jenkins isn't reachable by a webhook:

```groovy
pipeline {
    agent any
    triggers {
        pollSCM('H/5 * * * *')
    }
    stages {
        stage('Build') {
            steps { sh 'make build' }
        }
    }
}
```

A nightly scheduled pipeline using `cron`, with `H` to spread load rather than firing at exactly midnight:

```groovy
pipeline {
    agent any
    triggers {
        cron('H 2 * * *')   // once per night, sometime around 2am
    }
    stages {
        stage('Nightly regression suite') {
            steps { sh './run-full-regression.sh' }
        }
    }
}
```

Setting up a GitHub webhook so pushes trigger a Multibranch Pipeline scan immediately (configured on the GitHub repo side, pointing at the Jenkins instance):

```
GitHub repo Settings > Webhooks > Add webhook
  Payload URL: https://jenkins.example.com/github-webhook/
  Content type: application/json
  Events: Just the push event (or "Let me select individual events" for PRs too)
```

## Common Pitfalls / Gotchas

- Configuring both a webhook and aggressive polling for the same job — redundant, and polling still consumes SCM API rate limits and Jenkins resources even though the webhook already covers the common case.
- Forgetting that Jenkins needs a reachable, correctly-routed endpoint (often behind a reverse proxy) for the SCM host to deliver webhook payloads to — a webhook silently failing (firewall, wrong URL, expired secret) looks identical to "nothing changed" from the pipeline's perspective, with no obvious error.
- Writing `cron('0 2 * * *')` instead of using `H` for the minute/hour field, causing many jobs scheduled at the same nominal time to all fire simultaneously and overload agent capacity.
- Relying on polling with a long interval (e.g., hourly) for time-sensitive CI, introducing an avoidable delay between a push and the corresponding build starting.
- Not securing the webhook endpoint (no shared secret/signature validation) so it can't be used by anyone who discovers the URL to trigger unwanted builds.

## Interview Questions & Answers

**Q: What's the difference between a webhook trigger and polling for triggering a Jenkins build?**
A: A webhook is Jenkins reacting to an HTTP callback that the SCM host sends the instant a relevant event happens (push, PR), giving near-instant build starts. Polling is Jenkins periodically checking the SCM on a schedule for new commits, which is less responsive (bounded by the polling interval) but doesn't require the SCM host to have network access to reach Jenkins.

**Q: Why would you choose polling over a webhook in a real deployment?**
A: When Jenkins is behind a firewall or in a private network the SCM host's webhook delivery can't reach, and setting up a secure inbound path just for webhooks isn't feasible or desired — polling only requires outbound access from Jenkins to the SCM, which is usually already open.

**Q: What does the `H` symbol mean in Jenkins cron syntax, and why does it matter?**
A: `H` (hash) tells Jenkins to pick a pseudo-random but consistent value within the given field's range, based on a hash of the job name, instead of a fixed value. This spreads out jobs that share a nominal schedule (e.g., many "nightly at 2am" jobs) across the actual minute/hour window, avoiding all of them firing at the exact same instant and overloading the Jenkins controller or agents.

**Q: How do webhooks interact with Multibranch Pipeline jobs specifically?**
A: The SCM webhook needs to notify Jenkins about branch- and PR-level events (new branch, new commit, new/updated PR), not just pushes to a single fixed branch, so the corresponding Jenkins plugin (GitHub Branch Source, GitLab, etc.) can trigger a rescan and create/update/remove the per-branch pipeline jobs automatically as branches and PRs come and go.

**Q: A push to a repository isn't triggering a build even though the webhook is configured — how would you debug it?**
A: Check the SCM host's webhook delivery log (GitHub shows recent deliveries and response codes) to see if the payload actually reached Jenkins and what response it got; check that the Jenkins endpoint URL, port, and any reverse proxy routing are correct and reachable from the SCM host's network; check Jenkins's own system log for webhook-related plugin errors; and as a fallback, confirm whether the job would build correctly if triggered manually, to isolate "trigger delivery problem" from "pipeline itself is broken."

## Related Topics

- [using-jenkins.md](./using-jenkins.md)
- [pipeline.md](./pipeline.md)
- [pipeline-troubleshooting.md](./pipeline-troubleshooting.md)
- [jenkinsfile.md](./jenkinsfile.md)
