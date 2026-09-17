# Configuration Management

Configuration management is the practice of defining and enforcing the desired state of a server or system's configuration — installed packages, running services, file contents, permissions, users — through code, rather than through someone SSHing in and running commands by hand. The problem it solves is "configuration drift": over time, manually-managed servers accumulate small, undocumented differences from each other and from what anyone believes is deployed, until nobody can confidently answer "what's actually running on that box" or reproduce it from scratch. Tools like Ansible, Chef, and Puppet exist to make server configuration declarative, versioned, and repeatable in the same way source control made application code versioned and repeatable.

The central concept across all of these tools is **desired-state configuration**: instead of writing a script that says "install nginx, then start it, then open port 80" (an imperative sequence of steps), you write a declaration that says "nginx should be installed, running, and port 80 should be open" and let the tool figure out what actions are needed to get there. This matters because desired-state definitions are **idempotent** by design — running the same configuration against a server ten times produces the same end state as running it once, because the tool only takes action on the gap between current and desired state. An imperative script re-run on an already-configured server might error out (package already installed) or duplicate effects (a line appended to a config file twice); a well-written desired-state definition just confirms "already correct" and does nothing.

Ansible, Chef, and Puppet differ mainly in architecture and language. Ansible is agentless — it connects over SSH and pushes changes from a control machine, so there's nothing to install or maintain on managed nodes, and playbooks are written in YAML, which is easy to read but has real limits for complex logic. Chef and Puppet are agent-based — a daemon runs on each managed node, periodically pulls its configuration ("recipes" in Chef, "manifests" in Puppet, both closer to a full programming language: Ruby-based DSLs) from a central server, and reconciles itself — which scales well to very large fleets but requires managing the agents themselves. In interviews, the important distinction isn't "which tool is best" (there's no universal answer) but demonstrating you understand *why* desired-state and idempotency matter more than the specific tool, since that concept also underlies infrastructure-as-code tools like Terraform, just applied to the OS/application layer instead of the cloud-resource layer.

## Examples

```yaml
# Ansible playbook: desired state for a web server
- hosts: webservers
  become: true
  tasks:
    - name: Ensure nginx is installed
      apt:
        name: nginx
        state: present

    - name: Ensure nginx is running and enabled at boot
      service:
        name: nginx
        state: started
        enabled: true

    - name: Deploy the site config
      template:
        src: nginx.conf.j2
        dest: /etc/nginx/sites-available/default
      notify: restart nginx

  handlers:
    - name: restart nginx
      service:
        name: nginx
        state: restarted
```

```ruby
# Chef recipe — same desired state, Chef's Ruby-based DSL
package 'nginx' do
  action :install
end

service 'nginx' do
  action [:enable, :start]
end

template '/etc/nginx/sites-available/default' do
  source 'nginx.conf.erb'
  notifies :restart, 'service[nginx]'
end
```

```text
Idempotency in practice:

Run 1 on a fresh server: installs nginx, starts service, writes config
  -> changed: 3 tasks

Run 2 on the same, now-configured server: nothing to do
  -> changed: 0 tasks, ok: 3 tasks

A correctly written playbook/manifest is safe to re-run at any time;
if a second run keeps reporting "changed," that's a bug in the
definition, not expected behavior.
```

## Common Pitfalls / Gotchas

- Writing configuration management scripts imperatively ("run this shell command") instead of declaratively — this loses idempotency and makes re-runs unsafe or unpredictable.
- Letting configuration drift happen anyway by allowing manual SSH changes on "managed" servers — any out-of-band change silently breaks the assumption that the tool's definition matches reality until the next enforced run overwrites it (or doesn't, depending on the tool's drift-detection settings).
- Storing secrets (passwords, API keys) directly in playbooks/manifests/recipes committed to source control instead of using a secrets-management integration (Vault, Ansible Vault, encrypted data bags).
- Assuming agentless (Ansible) is always simpler than agent-based (Chef/Puppet) — agentless avoids agent maintenance but pushes configuration on-demand rather than continuously enforcing it, so drift between runs can persist longer unless you schedule frequent runs.
- Not testing configuration changes in a non-production environment first — a bad desired-state definition applied fleet-wide can take down every managed server at once, faster than a manual rollout would have.

## Interview Questions & Answers

**Q: What problem does configuration management solve that plain shell scripts don't?**
A: It solves configuration drift and unsafe re-runs. Shell scripts are typically imperative and not idempotent — running one twice can error out or double-apply an effect. Configuration management tools describe the *desired end state* declaratively and are idempotent by design, so running the same definition repeatedly always converges to the same correct state regardless of the server's starting condition.

**Q: What does idempotent mean in the context of configuration management, and why does it matter?**
A: An idempotent operation produces the same result no matter how many times it's applied. It matters because configuration management tools are meant to be re-run routinely (on a schedule, or every deploy) to correct drift — if applying the same configuration twice could produce a different or broken state, you couldn't trust the automation to self-heal a server, which is one of the main reasons to use these tools in the first place.

**Q: What's the architectural difference between Ansible and Chef/Puppet?**
A: Ansible is agentless — it connects over SSH from a control machine and pushes configuration on demand, so there's nothing extra to install or maintain on managed nodes. Chef and Puppet are agent-based — a daemon on each node periodically pulls its configuration from a central server and reconciles itself continuously. Agentless is simpler to bootstrap; agent-based scales continuous enforcement better across very large, long-running fleets.

**Q: How does configuration management relate to infrastructure as code?**
A: They're complementary layers of the same idea — declarative, versioned, idempotent automation — applied to different layers. Infrastructure as code (Terraform, CloudFormation) typically provisions the resources themselves (VMs, networks, load balancers); configuration management (Ansible, Chef, Puppet) configures what runs *inside* those resources (packages, services, files). Many pipelines use both: Terraform to stand up a VM, then Ansible to configure it.

**Q: How would you handle secrets inside a configuration management playbook without committing them to source control?**
A: Use the tool's secrets integration instead of plaintext — Ansible Vault to encrypt sensitive variables within the repo, or better, pull secrets at run time from a dedicated secrets manager like HashiCorp Vault or AWS Secrets Manager so the plaintext credential never lives in version control at all, only a reference to where it can be fetched.

## Related Topics

- [infrastructure-as-code.md](./infrastructure-as-code.md)
- [secrets-management.md](./secrets-management.md)
- [ci-cd.md](./ci-cd.md)
