# Using Jenkins

Day-to-day Jenkins usage centers on **jobs** (also called projects) — the configured unit of work that Jenkins schedules and runs. Jenkins supports several job types, but the two that matter most in practice are **Freestyle** (a UI-configured, single-linear-sequence build defined entirely through form fields in Jenkins's own state) and **Pipeline** (a code-defined, Jenkinsfile-driven workflow, covered in depth elsewhere in this folder). A closely related type, **Multibranch Pipeline**, automatically discovers and creates a pipeline job per branch/PR in a repository that contains a Jenkinsfile, which is how most real teams actually consume pipeline jobs rather than manually creating one job per branch.

The Jenkins web UI organizes around a dashboard listing jobs, each with a build history, a "Build Now" trigger, and (for pipeline jobs) a visual stage graph showing how the most recent runs progressed through each stage. Each individual build gets its own page with console output, test results, archived artifacts, and — critically for debugging — the exact parameters and environment it ran with, which is often the first place to look when a build behaves unexpectedly.

**Blue Ocean** is Jenkins's alternate, pipeline-focused UI (a plugin, not the default classic UI) that presents pipeline runs as a clean visual flow of stages with a friendlier editor for creating declarative pipelines without hand-writing Groovy. It was designed to make pipeline visualization and status easier to read than the classic UI's stage view, particularly for parallel and complex multi-stage pipelines, though many teams still primarily use the classic UI plus the Jenkinsfile itself as the source of truth.

Beyond individual jobs, Jenkins administration includes managing plugins (Manage Jenkins > Plugins), configuring global tools (JDK, Node, Maven versions available to jobs), managing the credentials store, configuring agents/clouds, and applying role-based access control so different teams can manage their own jobs without full admin rights to the whole instance — all of which matters once Jenkins moves from "one person's experiment" to "the CI system the whole org depends on."

## Examples

Creating a job as "Pipeline from SCM," the standard way real teams wire a repository's Jenkinsfile into Jenkins (conceptual UI flow, expressed as the resulting job config's key fields):

```
New Item > Pipeline > "my-service-pipeline"
  Definition: Pipeline script from SCM
  SCM: Git
  Repository URL: https://github.com/org/my-service.git
  Script Path: Jenkinsfile
```

Triggering and inspecting a build from the Jenkins CLI — a common scripting/automation entry point outside the UI:

```bash
java -jar jenkins-cli.jar -s http://localhost:8080/ \
  build my-service-pipeline -f -v

java -jar jenkins-cli.jar -s http://localhost:8080/ \
  console my-service-pipeline -f
```

Using the Jenkins REST API to check the last build's status, useful for external dashboards or scripts:

```bash
curl -s -u user:api_token \
  http://localhost:8080/job/my-service-pipeline/lastBuild/api/json \
  | jq '.result, .duration'
```

## Common Pitfalls / Gotchas

- Configuring a job purely through the UI's build steps instead of pointing it at a Jenkinsfile — loses versioning and reproducibility, and doesn't scale past a single job.
- Manually creating one pipeline job per branch instead of using Multibranch Pipeline, leading to drift and forgotten stale jobs for deleted branches.
- Giving every user full Jenkins admin rights instead of configuring role-based access control, creating both a security risk and accidental cross-team configuration changes.
- Not archiving build artifacts or test results, making post-hoc debugging of a failed build impossible once the workspace is cleaned up.
- Treating Blue Ocean and the classic UI as fully interchangeable — some administrative configuration (credentials, system settings, plugin management) is only available in the classic UI, not Blue Ocean.

## Interview Questions & Answers

**Q: What are the main Jenkins job types, and when would you use each?**
A: Freestyle jobs are UI-configured, single-sequence builds with no code-based definition — simple but not versioned. Pipeline jobs run a Jenkinsfile, supporting complex, code-defined, multi-stage workflows with parallelism and conditional logic. Multibranch Pipeline automatically creates a pipeline job per branch/PR containing a Jenkinsfile. In practice, almost all serious CI/CD work uses Pipeline or Multibranch Pipeline; Freestyle survives mainly for very simple, legacy, or one-off tasks.

**Q: What is Blue Ocean, and how does it relate to the classic Jenkins UI?**
A: Blue Ocean is a plugin providing an alternate, pipeline-focused UI with a cleaner visual representation of stage execution and a guided editor for declarative pipelines. It's built on top of the same underlying pipeline execution as the classic UI — it doesn't change how pipelines run, only how they're visualized and edited — and some administrative functionality remains classic-UI-only.

**Q: How would you wire a GitHub repository's Jenkinsfile into Jenkins so every branch gets built automatically?**
A: Create a Multibranch Pipeline job (or Organization Folder for scanning an entire GitHub org), point it at the repository, and configure the script path (default `Jenkinsfile`). Jenkins then periodically scans the repo's branches/PRs and automatically creates, updates, or removes a pipeline job for each one that contains the file.

**Q: What information would you check first when a specific build fails unexpectedly?**
A: The build's console output for the actual error, which stage failed (from the pipeline graph), the parameters/environment variables that build ran with, and whether the failure is specific to this build (a real code/test regression) or an infrastructure issue (agent unavailable, network failure, flaky test) by comparing against recent build history.

**Q: How do you avoid giving every developer full admin access while still letting teams manage their own jobs?**
A: Configure role-based access control (via the Role-based Authorization Strategy plugin or similar), scoping permissions to specific job folders/patterns so a team can create, configure, and trigger builds for jobs in their own namespace without having system-wide admin rights (plugin management, global credentials, agent configuration).

## Related Topics

- [installing-jenkins.md](./installing-jenkins.md)
- [freestyle-vs-pipeline.md](./freestyle-vs-pipeline.md)
- [jenkinsfile.md](./jenkinsfile.md)
- [webhooks.md](./webhooks.md)
