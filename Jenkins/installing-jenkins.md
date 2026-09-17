# Installing Jenkins

Jenkins can run almost anywhere a JVM can: as a native package on Linux/Windows/macOS, as a standalone WAR file behind any servlet container, or — far and away the most common approach today — as a Docker container. The official `jenkins/jenkins` images on Docker Hub bundle the LTS (long-term support) release with a specific JDK version and are the recommended starting point for both local experimentation and production, since they make the controller's exact runtime reproducible and disposable.

Regardless of install method, Jenkins needs a persistent `JENKINS_HOME` directory — this is where job configuration, build history, plugins, credentials, and secrets all live. Losing `JENKINS_HOME` without a backup means losing the entire instance's configuration, so any real install (Docker volume, dedicated disk, EBS volume, etc.) treats that directory as the thing to back up and protect, not the Jenkins binary itself. Minimum resource requirements are modest (roughly 256MB RAM / 1GB disk for the smallest possible instance), but any real team-scale controller wants several GB of RAM and enough disk for build history and workspace checkouts, plus Java installed since Jenkins itself is a JVM application.

First-run setup follows a fixed sequence: Jenkins boots, generates a random initial admin password written to a file inside `JENKINS_HOME`, and the setup wizard in the browser asks for that password before letting you install the "suggested plugins" bundle (Git, pipeline, credentials, and other commonly needed plugins) and create the first admin user. After that one-time wizard, Jenkins is a running controller ready to have jobs, agents, and credentials configured.

For production and cloud deployments, installing directly on a VM (e.g., an EC2 instance) remains common in environments that want Jenkins to be a long-lived, directly-managed service rather than a container workload, and it is one of the most frequently tested "can you actually set this up" interview scenarios.

## Examples

Installing Jenkins on a fresh Debian/Ubuntu EC2 instance (a classic real-world install path):

```bash
sudo apt-get update
java -version   # verify Java is present; Jenkins requires it

# Add the Jenkins repository key and source
curl -fsSL https://pkg.jenkins.io/debian/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc]" \
  "https://pkg.jenkins.io/debian binary/" | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt-get update
sudo apt-get install -y jenkins

sudo systemctl start jenkins
sudo systemctl status jenkins
# Then open http://<public-ip>:8080 and enter the initial admin password
```

Running Jenkins in Docker with a persistent volume, the fastest path for local dev or disposable environments:

```bash
docker volume create jenkins_home
docker run -d --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  jenkins/jenkins:lts-jdk17

# Retrieve the initial admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Installing Jenkins via Helm on Kubernetes, common for teams already running k8s clusters:

```bash
helm repo add jenkins https://charts.jenkins.io
helm repo update
helm install jenkins jenkins/jenkins \
  --namespace jenkins --create-namespace \
  --set controller.serviceType=LoadBalancer
```

## Common Pitfalls / Gotchas

- Not mounting/backing up `JENKINS_HOME` as a persistent volume — restarting an ephemeral container without a volume wipes all jobs, credentials, and plugins.
- Forgetting to open/forward the correct ports (8080 for the UI, 50000 for inbound JNLP agent connections) in security groups or firewalls.
- Installing every "suggested" plugin without pruning later, growing an unmanageable plugin surface that slows startup and complicates upgrades.
- Running Jenkins as root or with an oversized IAM/service-account role "just to make it work" — the controller becomes a high-value target since it holds credentials for every downstream system it deploys to.
- Skipping Java version compatibility checks — a given Jenkins LTS release supports a specific range of JDK versions, and mismatches cause cryptic startup failures.

## Interview Questions & Answers

**Q: What are the main ways to install Jenkins, and which would you pick for a new project?**
A: Native OS package, WAR file in a servlet container, Docker container, or Helm chart on Kubernetes. For a new project I'd default to the official Docker image with a named volume for `JENKINS_HOME` — it's reproducible, easy to upgrade by swapping the image tag, and trivially portable between local dev and a real host, whereas a native package ties you to that machine's OS lifecycle.

**Q: What is `JENKINS_HOME` and why does it matter operationally?**
A: It's the directory holding all of Jenkins's persistent state — job configs, build history, plugins, credentials, and secrets. It's the one thing that must be backed up and preserved across restarts/upgrades; losing it without a backup means rebuilding the entire instance's configuration from scratch.

**Q: Walk through what happens the first time Jenkins starts up.**
A: Jenkins generates a random initial admin password and writes it to a file under `JENKINS_HOME/secrets/initialAdminPassword`. The setup wizard in the browser asks for that password, then offers to install a suggested plugin bundle and prompts you to create the first admin user — after that, Jenkins is ready to configure jobs and agents.

**Q: What resources does Jenkins need, and how does that change at team scale?**
A: The documented minimum is around 256MB RAM and 1GB disk, but that's only realistic for a trivial single-job instance. A real team controller needs several GB of RAM (Jenkins itself plus each running build's JVM overhead), fast disk for workspaces and build archives, and — critically — should offload actual build execution to separate agent nodes rather than running builds on the controller.

**Q: Why would you choose to run build agents separately from the Jenkins controller instead of installing everything on one machine?**
A: Running builds on the controller couples untrusted build workload to the one system holding all credentials and managing the whole instance — a compromised or resource-exhausted build can take down or compromise Jenkins itself. Separate agents isolate build execution, let you scale capacity independently, and support heterogeneous build environments (different OSes, Docker-in-Docker, GPU nodes) without touching the controller.

## Related Topics

- [introduction-to-jenkins.md](./introduction-to-jenkins.md)
- [agents-and-executors.md](./agents-and-executors.md)
- [using-jenkins.md](./using-jenkins.md)
- [credentials-management.md](./credentials-management.md)
