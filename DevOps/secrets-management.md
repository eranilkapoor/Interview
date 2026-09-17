# Secrets Management

Secrets management is the discipline of storing, distributing, and rotating sensitive credentials — database passwords, API keys, TLS private keys, cloud IAM tokens — without ever putting them in plaintext where they don't need to be: not in source code, not in config files committed to Git, not in CI logs, not in Docker images. The core risk secrets management protects against is exposure through the most mundane channel imaginable — a `.env` file accidentally committed, an API key pasted into a Slack message for debugging, a credential baked into a Docker image layer that anyone who pulls the image can extract. Version control makes this worse than it sounds: because Git preserves full history, committing a secret and deleting it in a later commit does not remove it — the credential is still retrievable from history, so the only real remedy after an accidental commit is treating it as compromised and rotating it immediately.

Dedicated secrets managers — HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager — exist to give applications and pipelines access to secrets without those secrets ever being written to disk in plaintext outside the vault itself. The pattern is: the secret lives encrypted in the vault, an application or pipeline authenticates to the vault at runtime (using its own short-lived, scoped identity — an IAM role, a Kubernetes service account token, an AppRole), and the vault returns the secret over an authenticated, audited channel, ideally straight into memory rather than a file on disk. This is a meaningful upgrade over the older pattern of "secrets live in environment variables set in a config management tool or CI settings page," because a vault gives you centralized audit logging (who accessed which secret, when), fine-grained access policies, and — critically — rotation.

Rotation is the part that separates mature secrets management from just "encrypted storage." A static credential that never changes is a permanent liability: the day it leaks (and eventually, something leaks) it stays valid and exploitable until someone notices and manually changes it, which in practice can be weeks or months. Automatic rotation — the vault periodically generates a new credential, updates the downstream system (e.g., changes the database user's password) and pushes the new value to consumers, often without any human involvement or application downtime — shrinks that exposure window dramatically, and some systems go further with **dynamic secrets**: instead of one long-lived shared credential, the vault issues a unique, short-lived credential per request or per session, so there's no persistent secret to leak in the first place — it simply expires.

## Examples

```bash
# Anti-pattern: secret hardcoded directly in application config, committed to git
# config.py
DATABASE_PASSWORD = "Sup3rSecretPassword!"   # DO NOT DO THIS
```

```bash
# Better: fetch the secret at runtime from Vault, nothing sensitive in the repo
export VAULT_ADDR="https://vault.internal:8200"
vault login -method=aws role=my-app-role

DB_PASSWORD=$(vault kv get -field=password secret/data/prod/db)
# The password exists only in this shell's memory at runtime,
# never written to a config file or committed anywhere.
```

```hcl
# AWS Secrets Manager reference in Terraform — the secret's ARN is
# in code; the secret VALUE is never in code or state in plaintext
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/db/password"
}

resource "aws_db_instance" "main" {
  # ...
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}
```

```yaml
# .gitignore — the cheapest first line of defense
.env
*.pem
*.key
secrets/
```

## Common Pitfalls / Gotchas

- Committing a `.env` file or credentials file to Git, even briefly — because history is preserved, the fix is rotating the credential, not just deleting the file in a later commit.
- Baking secrets into a Docker image (e.g. via a build ARG that lands in a layer) — anyone who can pull the image can extract the secret from its layer history even if the final `Dockerfile` doesn't reference it directly.
- Using one long-lived, shared credential across every environment (dev, staging, prod) — a leak in a low-security dev environment then compromises production too.
- Logging secrets accidentally — a debug log line that prints a full request payload or environment dump can leak a credential into a log aggregation system that many more people have access to than the vault itself.
- Treating secrets management as "encrypt it and forget it" without rotation — a static, never-rotated secret has an unbounded exposure window once it leaks, however well it was stored beforehand.

## Interview Questions & Answers

**Q: Why shouldn't secrets be stored in environment variables set through a CI/CD tool's UI instead of a dedicated secrets manager?**
A: CI-level environment variables are usually static, often visible to anyone with pipeline-edit access, frequently get echoed into build logs by accident, and have no built-in rotation or audit trail. A dedicated secrets manager provides centralized access policies, an audit log of exactly who/what accessed a secret and when, and automatic rotation — none of which a CI tool's plain env var settings give you.

**Q: If a secret gets accidentally committed to a Git repository, is deleting it in the next commit sufficient?**
A: No. Git preserves the full commit history, so the secret remains retrievable from the earlier commit even after a later commit removes it — anyone with repo access (or who cloned it before the fix) can still find it. The only reliable fix is rotating the credential immediately, treating it as compromised, and separately rewriting history if it must also be purged from the repository.

**Q: What's the difference between static and dynamic secrets?**
A: A static secret is a long-lived credential (like a database password) that stays valid until someone manually or automatically rotates it. A dynamic secret is generated uniquely and temporarily per request or session by the secrets manager — for example, a database credential that's created when an application requests it and automatically expires shortly after — so there's no persistent, reusable credential sitting around to leak.

**Q: How does secret rotation reduce risk, and what makes it hard to do well?**
A: It shrinks the window during which a leaked credential remains usable — if a static password never rotates, a leak stays exploitable indefinitely; if it rotates every 24 hours automatically, a leak is only useful for at most a day. It's hard because rotation has to update every downstream consumer of that secret without causing an outage — the vault, the actual resource (e.g. the database user), and every application instance holding the old value all need to be coordinated, which is why most teams rely on a secrets manager's built-in rotation rather than rolling their own.

**Q: How would you design secret access for a CI/CD pipeline that deploys to production?**
A: Give the pipeline a short-lived, scoped identity (an OIDC-federated cloud role rather than a long-lived static access key) that it uses to authenticate to the secrets manager at run time, request only the specific secrets that step needs, and never persist those secrets to disk or print them to logs. Scope the identity's permissions to exactly what that pipeline stage needs — broad, standing credentials on a CI runner are a common way a single compromised pipeline turns into a full production breach.

## Related Topics

- [configuration-management.md](./configuration-management.md)
- [infrastructure-as-code.md](./infrastructure-as-code.md)
- [source-code-management.md](./source-code-management.md)
