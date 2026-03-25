# Scan Targets — Complete File Path Reference

## Cloud Provider Credentials

### AWS

| Path | Contains | Risk |
|------|----------|------|
| `~/.aws/credentials` | Access Key ID + Secret Access Key (plaintext) | Critical |
| `~/.aws/config` | Region, profile names, SSO config | Low |
| `~/.aws/sso/cache/` | SSO session tokens (JSON) | High |

### GCP / Google Cloud

| Path | Contains | Risk |
|------|----------|------|
| `~/.config/gcloud/credentials.db` | OAuth credentials (SQLite) | Critical |
| `~/.config/gcloud/access_tokens.db` | Access tokens (SQLite) | Critical |
| `~/.config/gcloud/application_default_credentials.json` | ADC with refresh_token + client_secret | Critical |
| `~/.config/gcloud/properties` | Active project/account config | Low |
| `~/.config/gcloud/configurations/` | Named configs per project | Low |

### Azure

| Path | Contains | Risk |
|------|----------|------|
| `~/.azure/accessTokens.json` | OAuth access tokens | Critical |
| `~/.azure/azureProfile.json` | Subscription info | Low |
| `~/.azure/msal_token_cache.json` | MSAL token cache | Critical |

### DigitalOcean

| Path | Contains | Risk |
|------|----------|------|
| `~/.config/doctl/config.yaml` | API token | Critical |

## Kubernetes

| Path | Contains | Risk |
|------|----------|------|
| `~/.kube/config` | Cluster endpoints + client certs + tokens | Critical |
| `~/.kube/custom-contexts/*.yml` | Additional cluster configs (may include GKE, on-prem) | Critical |
| `~/.kube/cache/` | Cached API responses | Low |

Check `~/.zshrc` or `~/.bashrc` for `KUBECONFIG` env var pointing to additional configs.

## Container & Registry

| Path | Contains | Risk |
|------|----------|------|
| `~/.docker/config.json` | Registry auth (may use keychain or plaintext) | High |
| `~/.colima/` | Colima VM configs | Low |
| `~/.orbstack/ssh/id_ed25519` | OrbStack SSH key | High |

## SSH & Git

| Path | Contains | Risk |
|------|----------|------|
| `~/.ssh/id_*` | SSH private keys | Critical |
| `~/.ssh/*.local.bak` | Backup private keys (often forgotten) | Critical |
| `~/.ssh/config` | Host mappings, usernames, key paths | Medium |
| `~/.ssh/known_hosts` | Infrastructure topology | Low |
| `~/.ssh/authorized_keys` | Inbound SSH access config | Medium |
| `~/.git-credentials` | Git HTTPS credentials (plaintext) | Critical |
| `~/.gitconfig` | User identity, GPG key ID | Low |

## Development Tool Tokens

| Path | Contains | Risk |
|------|----------|------|
| `~/.config/gh/hosts.yml` | GitHub CLI OAuth token (may ref keychain); if compromised: `gh auth logout` + Revoke OAuth App access on github.com + `gh auth login` to re-bind | Critical |
| `~/.config/glab-cli/config.yml` | GitLab CLI PAT (often plaintext) | Critical |
| `~/.npmrc` | npm registry auth token | Critical |
| `~/.config/pip/pip.conf` | PyPI index credentials | High |
| `~/.pypirc` | PyPI upload credentials | Critical |
| `~/.gem/credentials` | RubyGems API key | High |
| `~/.cargo/credentials.toml` | crates.io token | High |
| `~/.config/composer/auth.json` | Packagist/PHP registry auth | High |
| `~/.nuget/NuGet.Config` | NuGet API keys | High |
| `~/.terraform.d/credentials.tfrc.json` | Terraform Cloud token | Critical |
| `~/.helm/repository/repositories.yaml` | Helm repo credentials | High |

## GPG Keys

| Path | Contains | Risk |
|------|----------|------|
| `~/.gnupg/private-keys-v1.d/*.key` | GPG private keys | High |
| `~/.gnupg/pubring.kbx` | Public keyring | Low |
| `~/.gnupg/trustdb.gpg` | Trust database | Low |

## Crypto Wallets

| Path | Contains | Risk |
|------|----------|------|
| `~/.config/solana/id.json` | Solana keypair (plaintext!) | Critical+ |
| `~/.electrum/wallets/` | Bitcoin wallets (encrypted) | Critical |
| `~/.electrum/config` | RPC password | High |
| `~/Library/Application Support/@onekeyhq/desktop/Local Storage/leveldb/` | OneKey wallet data | High |
| `~/Library/Application Support/Ledger Live/Local Storage/leveldb/` | Ledger account data | Medium |
| `~/Library/Application Support/@tonkeeper/desktop/Local Storage/leveldb/` | TON wallet data | High |
| `~/.ethereum/keystore/` | Ethereum keystore files | Critical |
| `~/.bitcoin/wallet.dat` | Bitcoin Core wallet | Critical |

## Shell History & Environment

| Path | Contains | Risk |
|------|----------|------|
| `~/.zsh_history` | Command history (may contain tokens) | High |
| `~/.bash_history` | Command history | High |
| `~/.zshrc` | Env vars, KUBECONFIG, PATH, aliases | Medium |
| `~/.bashrc` | Env vars | Medium |
| `~/.zprofile` | Login shell env vars | Medium |
| `~/.bash_profile` | Login shell env vars | Medium |
| `~/.zshenv` | All-shell env vars | Medium |

## .env Files

Search pattern:

```bash
find ~ -maxdepth 5 \( -name ".env" -o -name ".env.*" \) 2>/dev/null | grep -v node_modules | grep -v .git
```

Priority: `.env.production` > `.env.staging` > `.env` > `.env.development` > `.env.example`

## VPN Configurations

| Path | Contains | Risk |
|------|----------|------|
| `~/Documents/**/*.ovpn` | OpenVPN configs (may embed certs) | Critical |
| `~/Downloads/**/*.ovpn` | Downloaded VPN configs | Critical |
| `/etc/wireguard/*.conf` | WireGuard configs with private keys | Critical |
| `~/Library/Keychains/openvpn.keychain-db` | OpenVPN keychain | High |

## Application Configs with Potential Secrets

| Path | Contains | Risk |
|------|----------|------|
| `~/.config/raycast/config.json` | Raycast API token | High |
| `~/.config/op/config` | 1Password CLI device UUID | Low |
| `~/.config/netlify/config.json` | Netlify auth token | High |
| `~/.config/vercel/auth.json` | Vercel token | High |
| `~/.config/firebase/` | Firebase tokens | High |
| `~/.config/supabase/` | Supabase access token | High |

## macOS-Specific

| Path | Contains | Risk |
|------|----------|------|
| `~/Library/Keychains/login.keychain-db` | All stored passwords (encrypted) | Medium |
| `~/Library/Cookies/` | Safari cookies | Medium |
| `~/Library/Application Support/Google/Chrome/*/Login Data` | Chrome saved passwords (encrypted) | Medium |
| `~/Library/Application Support/Google/Chrome/*/Cookies` | Chrome cookies | Medium |
| `~/Library/Application Support/Firefox/Profiles/*/logins.json` | Firefox saved passwords | Medium |
