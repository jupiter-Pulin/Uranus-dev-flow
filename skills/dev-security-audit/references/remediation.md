# Remediation Procedures by Category

## AWS Credentials

1. Login to AWS Console → IAM → Users → Security Credentials
2. Deactivate the compromised Access Key
3. Create a new Access Key pair
4. Update `~/.aws/credentials` with the new key
5. Check CloudTrail logs for unauthorized activity during the attack window
6. Review IAM policies for any new users/roles/policies created

```bash
# Revoke via CLI (if still authenticated)
aws iam delete-access-key --access-key-id AKIA... --user-name <username>
```

## GCP / Google Cloud

```bash
# Revoke all authenticated accounts
gcloud auth revoke --all

# Revoke application default credentials
gcloud auth application-default revoke

# Re-authenticate
gcloud auth login
gcloud auth application-default login
```

Then in GCP Console:
1. IAM & Admin → Service Accounts → Review keys
2. Security → Audit Logs → Check for suspicious activity
3. Revoke any service account keys created during the attack window

## SSH Keys

1. Generate new key pair (prefer Ed25519):

   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   ```

2. Upload new public key to all services (GitHub, GitLab, etc.)
3. Update `~/.ssh/config` to point to new key
4. Update `authorized_keys` on all remote hosts
5. Test connectivity before deleting old keys
6. Delete old keys and backups

## Git Platform Tokens (GitHub/GitLab)

### GitHub

1. github.com → Settings → Developer Settings → Personal Access Tokens → **Revoke all tokens**
2. github.com → Settings → Applications → Authorized OAuth Apps → **Revoke Access** for `gh` CLI
3. Re-authenticate CLI:

   ```bash
   gh auth logout
   gh auth login          # re-bind with fresh token
   gh auth status         # verify new session
   gh auth refresh -s read:org,repo  # refresh scopes if needed
   ```

4. Review Security Log: github.com → Settings → Security log
5. Check for unauthorized SSH keys: github.com → Settings → SSH and GPG keys
6. Check for unauthorized OAuth apps or GitHub Apps added during attack window

### GitLab

1. gitlab.com → Preferences → Access Tokens → Revoke
2. Also check: `~/.config/glab-cli/config.yml` for additional tokens
3. Review Audit Events in GitLab admin

## npm Tokens

1. Login to npmjs.com → Access Tokens
2. Revoke compromised token
3. Generate new token
4. Update `~/.npmrc`:

   ```
   //registry.npmjs.org/:_authToken=<new-token>
   ```

5. Check if any packages were published during the attack window

## Kubernetes

1. For cloud-managed clusters (GKE/EKS/AKS):
   - Regenerate cluster credentials via cloud console
   - Delete old kubeconfig entries
2. For self-managed clusters:
   - Rotate client certificates
   - Invalidate service account tokens
3. Review K8s audit logs for suspicious API calls
4. Check for unauthorized pods, secrets access, RBAC changes

## Crypto Wallets

### Solana (plaintext keypair)

```bash
# 1. Check balance FIRST — do not delete before transferring
solana balance ~/.config/solana/id.json
# 2. If balance > 0, transfer ALL funds to a new wallet
solana-keygen new -o ~/.config/solana/new-keypair.json
solana transfer --from ~/.config/solana/id.json <new-pubkey> ALL
# 3. Only AFTER funds are safe, retire the compromised key
mv ~/.config/solana/id.json ~/.config/solana/id.json.compromised
# 4. Activate new key
mv ~/.config/solana/new-keypair.json ~/.config/solana/id.json
```

### Electrum (encrypted wallet files)

1. Open Electrum
2. Check balance in all 3 wallets
3. If any balance exists, immediately send ALL funds to a NEW wallet
4. The old wallet files may have been copied — even with encryption, they can be brute-forced offline

### Hardware wallets (Ledger/Trezor)

- Private keys are safe (on device)
- But account addresses and balances were exposed
- No action needed unless phishing is a concern

## Shell History

```bash
# Backup for reference (you'll need the token list for revocation)
cp ~/.zsh_history ~/.zsh_history.bak.$(date +%Y-%m-%d)
# Clear
echo "" > ~/.zsh_history
# Apply to current session
fc -p ~/.zsh_history
```

## VPN Configurations

1. Do NOT use the exposed VPN configs
2. Notify your IT/security team that VPN credentials may be compromised
3. Request new VPN certificates/configs
4. Delete old `.ovpn` files from disk

## GPG Keys

If your GPG private keys were accessible:
1. Evaluate if the passphrase is strong enough to resist offline cracking
2. If in doubt, revoke compromised keys:

   ```bash
   gpg --gen-revoke <KEY-ID>
   ```

3. Generate new keys and update Git signing config
4. Publish revocation to keyservers

## Communication Apps (Slack/Discord/Telegram)

1. **Slack**: Sign out of all devices (Workspace Settings → Sign out all other sessions)
2. **Discord**: Change password (triggers global session invalidation)
3. **Telegram**: Settings → Devices → Terminate all other sessions

## Browser Passwords (Chrome)

If Chrome Login Data was potentially exfiltrated:
1. Most critical: Change passwords for financial services, email, cloud providers
2. Enable 2FA everywhere possible
3. Consider using a password manager (1Password, Bitwarden) instead of browser storage
4. chrome://settings/passwords → Review all saved passwords

## .env Files

1. List all .env files found in the scan
2. For `.env.production` files: rotate ALL secrets immediately
3. For `.env.staging`/`.env.development`: evaluate risk, rotate if shared with production
4. For `.env.example`: usually safe (should not contain real secrets)
5. Consider using a secrets manager (Vault, AWS Secrets Manager, GCP Secret Manager) instead of .env files

## Docker Registry

If Docker credentials were exposed:
1. Docker Hub: hub.docker.com → Account Settings → Security → Revoke tokens
2. GCR/ECR: Managed via cloud IAM (handled by GCP/AWS revocation above)
3. Review push history for unauthorized image publishes

## Post-Remediation Monitoring (30 days)

Set up alerts for:
- [ ] GitHub/GitLab: New SSH keys, PATs, OAuth apps, deploy keys
- [ ] AWS: CloudTrail alerts for the compromised key's ARN
- [ ] GCP: Cloud Audit Logs for the revoked accounts
- [ ] npm: Publish notifications
- [ ] SSH: Login alerts on internal hosts (check `auth.log` or `secure`)
- [ ] K8s: API server audit logs for suspicious activity
