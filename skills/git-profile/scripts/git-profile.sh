#!/usr/bin/env bash
# git-profile.sh — Git identity and GPG signing profile manager
# Usage: bash scripts/run-skill.sh git-profile git-profile.sh <subcommand> [args...]
#
# Subcommands:
#   doctor [--json]       Diagnostic report (default)
#   discover              Auto-discover profiles from GPG + git config
#   list                  List registered profiles
#   resolve <profile>     Generate apply plan + plan-hash
#   apply --plan-hash <h> Apply profile to local config
#   remove-check <id>     Check if profile is safe to remove
#   remove-exec <id>      Execute profile removal
#   verify                Deep verification

set -euo pipefail

# --- Config ---
REGISTRY_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/sd0x-dev-flow"
REGISTRY_FILE="$REGISTRY_DIR/git-profiles.json"

# --- Helpers ---

json_error() {
  local msg="$1"
  jq -n --arg m "$msg" '{"error": $m}' >&2
  exit 2
}

ensure_registry_dir() {
  if [ ! -d "$REGISTRY_DIR" ]; then
    mkdir -p "$REGISTRY_DIR" 2>/dev/null || {
      # Fallback path
      REGISTRY_DIR="$HOME/.sd0x-dev-flow"
      REGISTRY_FILE="$REGISTRY_DIR/git-profiles.json"
      mkdir -p "$REGISTRY_DIR" 2>/dev/null || json_error "Cannot create registry directory"
    }
  fi
}

read_registry() {
  if [ -f "$REGISTRY_FILE" ]; then
    cat "$REGISTRY_FILE"
  else
    echo '{"version":1,"profiles":{},"active_repos":{}}'
  fi
}

write_registry() {
  local content="$1"
  ensure_registry_dir
  local lockdir="$REGISTRY_DIR/.git-profiles.lock"
  local retries=0
  while ! mkdir "$lockdir" 2>/dev/null; do
    retries=$((retries + 1))
    if [ "$retries" -ge 10 ]; then
      json_error "Cannot acquire registry lock after 10 retries (stale lock? remove $lockdir manually)"
    fi
    sleep 0.1
  done
  # shellcheck disable=SC2064
  trap "rm -rf '$lockdir' 2>/dev/null || true" EXIT
  local tmpfile
  tmpfile=$(mktemp "$REGISTRY_DIR/git-profiles.XXXXXX.tmp") || { rm -rf "$lockdir" 2>/dev/null; json_error "Cannot create temp file"; }
  printf '%s\n' "$content" > "$tmpfile"
  chmod 0600 "$tmpfile"
  mv "$tmpfile" "$REGISTRY_FILE"
  rm -rf "$lockdir" 2>/dev/null || true
  trap - EXIT
}

# SHA256 hash — first 8 hex chars
compute_hash() {
  local input="$1"
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$input" | shasum -a 256 | cut -c1-8
  elif command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$input" | sha256sum | cut -c1-8
  else
    json_error "No SHA256 tool available (need shasum or sha256sum)"
  fi
}

get_repo_path() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

# Build canonical plan JSON for a profile (deterministic for hashing)
build_plan() {
  local repo="$1" name="$2" email="$3" key="$4" fmt="$5"
  if [ -n "$key" ]; then
    jq -n \
      --arg repo "$repo" --arg name "$name" --arg email "$email" \
      --arg key "$key" --arg fmt "$fmt" \
      '{
        commands: [
          {key: "user.name", value: $name},
          {key: "user.email", value: $email},
          {key: "user.signingkey", value: $key},
          {key: "commit.gpgsign", value: "true"},
          {key: "gpg.format", value: $fmt}
        ],
        repo: $repo,
        target: "local"
      }'
  else
    jq -n \
      --arg repo "$repo" --arg name "$name" --arg email "$email" \
      '{
        commands: [
          {key: "user.name", value: $name},
          {key: "user.email", value: $email},
          {key: "user.signingkey", action: "unset"},
          {key: "commit.gpgsign", action: "unset"},
          {key: "gpg.format", action: "unset"}
        ],
        repo: $repo,
        target: "local"
      }'
  fi
}

# Get a git config value, empty string if unset
git_cfg() {
  git config --get "$1" 2>/dev/null || true
}

git_cfg_scoped() {
  git config --show-origin --show-scope --get "$1" 2>/dev/null || true
}

# --- GPG Parsing ---

# Parse gpg --list-secret-keys --with-colons output
# Returns JSON array of key objects
parse_gpg_keys() {
  if ! command -v gpg >/dev/null 2>&1; then
    echo '[]'
    return
  fi

  local gpg_output
  gpg_output=$(gpg --list-secret-keys --keyid-format long --with-colons 2>/dev/null) || {
    echo '[]'
    return
  }

  if [ -z "$gpg_output" ]; then
    echo '[]'
    return
  fi

  # Parse colon-delimited records
  local keys="[]"
  local current_keyid=""
  local current_validity=""
  local current_expires=""
  local current_fpr=""
  local uids="[]"

  while IFS= read -r line; do
    local record_type
    record_type=$(echo "$line" | cut -d: -f1)

    case "$record_type" in
      sec)
        # Flush previous key if exists
        if [ -n "$current_keyid" ]; then
          keys=$(printf '%s' "$keys" | jq --arg kid "$current_keyid" \
            --arg val "$current_validity" --arg exp "$current_expires" \
            --arg fpr "$current_fpr" --argjson uids "$uids" \
            '. + [{"keyid": $kid, "validity": $val, "expires": $exp, "fingerprint": $fpr, "uids": $uids}]')
        fi
        current_keyid=$(echo "$line" | cut -d: -f5)
        current_validity=$(echo "$line" | cut -d: -f2)
        current_expires=$(echo "$line" | cut -d: -f7)
        current_fpr=""
        uids="[]"
        ;;
      fpr)
        if [ -z "$current_fpr" ]; then
          current_fpr=$(echo "$line" | cut -d: -f10)
        fi
        ;;
      uid)
        local uid_str
        uid_str=$(echo "$line" | cut -d: -f10)
        local uid_validity
        uid_validity=$(echo "$line" | cut -d: -f2)
        # Extract name and email from "Name <email>" format
        local uid_name uid_email
        uid_name=$(echo "$uid_str" | sed -n 's/\(.*\) <.*>/\1/p')
        uid_email=$(echo "$uid_str" | sed -n 's/.*<\(.*\)>/\1/p')
        if [ -n "$uid_email" ]; then
          uids=$(printf '%s' "$uids" | jq --arg n "$uid_name" --arg e "$uid_email" \
            --arg v "$uid_validity" \
            '. + [{"name": $n, "email": $e, "validity": $v}]')
        fi
        ;;
    esac
  done <<< "$gpg_output"

  # Flush last key
  if [ -n "$current_keyid" ]; then
    keys=$(printf '%s' "$keys" | jq --arg kid "$current_keyid" \
      --arg val "$current_validity" --arg exp "$current_expires" \
      --arg fpr "$current_fpr" --argjson uids "$uids" \
      '. + [{"keyid": $kid, "validity": $val, "expires": $exp, "fingerprint": $fpr, "uids": $uids}]')
  fi

  echo "$keys"
}

# Check if a GPG key is active (not expired, not revoked)
is_key_active() {
  local validity="$1"
  local expires="$2"
  # validity: e=expired, r=revoked
  if [[ "$validity" == *e* ]] || [[ "$validity" == *r* ]]; then
    echo "false"
    return
  fi
  # Check expiry date if set
  if [ -n "$expires" ] && [ "$expires" != "0" ]; then
    local now
    now=$(date +%s)
    if [ "$expires" -le "$now" ] 2>/dev/null; then
      echo "false"
      return
    fi
  fi
  echo "true"
}

# Get key status string
key_status_str() {
  local validity="$1"
  local expires="$2"
  if [[ "$validity" == *r* ]]; then
    echo "revoked"
    return
  fi
  if [[ "$validity" == *e* ]]; then
    echo "expired"
    return
  fi
  if [ -n "$expires" ] && [ "$expires" != "0" ]; then
    local now
    now=$(date +%s)
    if [ "$expires" -le "$now" ] 2>/dev/null; then
      echo "expired"
      return
    fi
  fi
  echo "active"
}

# Format epoch to YYYY-MM-DD
epoch_to_date() {
  local epoch="$1"
  if [ -z "$epoch" ] || [ "$epoch" = "0" ]; then
    echo "never"
    return
  fi
  if date -r "$epoch" "+%Y-%m-%d" 2>/dev/null; then
    return
  fi
  # GNU date fallback
  date -d "@$epoch" "+%Y-%m-%d" 2>/dev/null || echo "$epoch"
}

# --- Subcommands ---

cmd_doctor() {
  local json_mode=false
  while [ $# -gt 0 ]; do
    case "$1" in
      --json) json_mode=true; shift ;;
      *) shift ;;
    esac
  done

  # 1. Effective identity
  local name name_scoped email email_scoped
  name=$(git_cfg user.name)
  email=$(git_cfg user.email)
  name_scoped=$(git_cfg_scoped user.name)
  email_scoped=$(git_cfg_scoped user.email)

  # Parse source from scoped output (format: "file:/path\tscope\tvalue")
  local name_source="unset" email_source="unset"
  if [ -n "$name_scoped" ]; then
    name_source=$(echo "$name_scoped" | awk '{print $1 " (" $2 ")"}' | head -1)
  fi
  if [ -n "$email_scoped" ]; then
    email_source=$(echo "$email_scoped" | awk '{print $1 " (" $2 ")"}' | head -1)
  fi

  # 2. Signing config
  local gpgsign signingkey gpg_format
  gpgsign=$(git_cfg commit.gpgsign)
  signingkey=$(git_cfg user.signingkey)
  gpg_format=$(git_cfg gpg.format)
  [ -z "$gpg_format" ] && gpg_format="openpgp"

  # 3. GPG key status
  local key_status="missing" key_expires=""
  if [ -n "$signingkey" ]; then
    local gpg_keys
    gpg_keys=$(parse_gpg_keys)
    # Find matching key by fingerprint suffix or key ID
    local matched_key
    matched_key=$(printf '%s' "$gpg_keys" | jq --arg sk "$signingkey" '
      [.[] | select(.fingerprint == $sk or .keyid == $sk or
        (.fingerprint | endswith($sk)) or (.keyid | endswith($sk)))] | first // null')
    if [ "$matched_key" != "null" ] && [ -n "$matched_key" ]; then
      local kv ke
      kv=$(printf '%s' "$matched_key" | jq -r '.validity')
      ke=$(printf '%s' "$matched_key" | jq -r '.expires')
      key_status=$(key_status_str "$kv" "$ke")
      key_expires=$(epoch_to_date "$ke")
    fi
    # key_status remains "missing" if signingkey is set but not found in GPG keyring
  fi

  # 4. Environment overrides
  local env_overrides='{}'
  local env_vars=("GIT_AUTHOR_NAME" "GIT_AUTHOR_EMAIL" "GIT_COMMITTER_NAME" "GIT_COMMITTER_EMAIL")
  for var in "${env_vars[@]}"; do
    local val="${!var:-}"
    if [ -n "$val" ]; then
      env_overrides=$(printf '%s' "$env_overrides" | jq --arg k "$var" --arg v "$val" '. + {($k): $v}')
    else
      env_overrides=$(printf '%s' "$env_overrides" | jq --arg k "$var" '. + {($k): null}')
    fi
  done

  # 5. Worktree detection
  local is_linked=false main_worktree=""
  local git_common_dir git_dir
  git_dir=$(git rev-parse --git-dir 2>/dev/null || echo "")
  git_common_dir=$(git rev-parse --git-common-dir 2>/dev/null || echo "")
  if [ -n "$git_dir" ] && [ -n "$git_common_dir" ]; then
    local abs_git_dir abs_common_dir
    abs_git_dir=$(cd "$git_dir" 2>/dev/null && pwd)
    abs_common_dir=$(cd "$git_common_dir" 2>/dev/null && pwd)
    if [ "$abs_git_dir" != "$abs_common_dir" ]; then
      is_linked=true
      main_worktree="$abs_common_dir"
    fi
  fi

  # 6. Issues
  local issues="[]"
  local overall_status="ok"

  if [ -z "$name" ]; then
    issues=$(printf '%s' "$issues" | jq '. + [{"severity":"halt","code":"MISSING_NAME","message":"user.name is not set"}]')
    overall_status="halt"
  fi
  if [ -z "$email" ]; then
    issues=$(printf '%s' "$issues" | jq '. + [{"severity":"halt","code":"MISSING_EMAIL","message":"user.email is not set"}]')
    overall_status="halt"
  fi
  # Multi-value identity conflict detection (only warn when values differ)
  local name_unique_count email_unique_count
  name_unique_count=$({ git config --get-all user.name 2>/dev/null || true; } | sort -u | wc -l | tr -d ' ')
  email_unique_count=$({ git config --get-all user.email 2>/dev/null || true; } | sort -u | wc -l | tr -d ' ')
  if [ "$name_unique_count" -gt 1 ] 2>/dev/null; then
    issues=$(printf '%s' "$issues" | jq '. + [{"severity":"warn","code":"MULTI_VALUE_NAME","message":"Multiple user.name values detected (scope conflict)"}]')
    [ "$overall_status" = "ok" ] && overall_status="warn"
  fi
  if [ "$email_unique_count" -gt 1 ] 2>/dev/null; then
    issues=$(printf '%s' "$issues" | jq '. + [{"severity":"warn","code":"MULTI_VALUE_EMAIL","message":"Multiple user.email values detected (scope conflict)"}]')
    [ "$overall_status" = "ok" ] && overall_status="warn"
  fi
  if [ -z "$signingkey" ]; then
    issues=$(printf '%s' "$issues" | jq '. + [{"severity":"warn","code":"NO_SIGNING_KEY","message":"No signing key configured"}]')
    [ "$overall_status" = "ok" ] && overall_status="warn"
  elif [ "$key_status" = "missing" ]; then
    issues=$(printf '%s' "$issues" | jq '. + [{"severity":"warn","code":"KEY_NOT_FOUND","message":"Signing key configured but not found in GPG keyring"}]')
    [ "$overall_status" = "ok" ] && overall_status="warn"
  fi
  if [ "$key_status" = "expired" ]; then
    issues=$(printf '%s' "$issues" | jq '. + [{"severity":"warn","code":"KEY_EXPIRED","message":"Signing key is expired"}]')
    [ "$overall_status" = "ok" ] && overall_status="warn"
  fi

  # Check env overrides
  for var in "${env_vars[@]}"; do
    if [ -n "${!var:-}" ]; then
      issues=$(printf '%s' "$issues" | jq --arg v "$var" '. + [{"severity":"warn","code":"ENV_OVERRIDE","message":("Environment variable " + $v + " is set")}]')
      [ "$overall_status" = "ok" ] && overall_status="warn"
    fi
  done

  if [ "$is_linked" = "true" ]; then
    issues=$(printf '%s' "$issues" | jq '. + [{"severity":"warn","code":"LINKED_WORKTREE","message":"This is a linked worktree. Config writes affect the main worktree."}]')
    [ "$overall_status" = "ok" ] && overall_status="warn"
  fi

  # 7. Profile match
  local matched_profile="null"
  if [ -f "$REGISTRY_FILE" ]; then
    local repo_path
    repo_path=$(get_repo_path)
    matched_profile=$(jq -r --arg rp "$repo_path" '.active_repos[$rp] // "null"' "$REGISTRY_FILE" 2>/dev/null || echo "null")
    if [ "$matched_profile" = "null" ]; then
      # Try matching by email
      matched_profile=$(jq -r --arg em "$email" '
        [.profiles | to_entries[] | select(.value.email == $em)] | first | .key // "null"
      ' "$REGISTRY_FILE" 2>/dev/null || echo "null")
    fi
  fi

  # 8. Build output
  local signing_enabled="false"
  [ "$gpgsign" = "true" ] && signing_enabled="true"

  local result
  result=$(jq -n \
    --arg status "$overall_status" \
    --arg name "$name" \
    --arg email "$email" \
    --arg name_source "$name_source" \
    --arg email_source "$email_source" \
    --argjson signing_enabled "$signing_enabled" \
    --arg signingkey "${signingkey:-}" \
    --arg gpg_format "$gpg_format" \
    --arg key_status "$key_status" \
    --arg key_expires "${key_expires:-}" \
    --argjson env_overrides "$env_overrides" \
    --argjson is_linked "$is_linked" \
    --arg main_wt "${main_worktree:-}" \
    --arg matched_profile "$matched_profile" \
    --argjson issues "$issues" \
    '{
      version: 1,
      status: $status,
      effective_identity: {
        name: $name,
        email: $email,
        name_source: $name_source,
        email_source: $email_source
      },
      signing: {
        enabled: $signing_enabled,
        key: $signingkey,
        format: $gpg_format,
        key_status: $key_status,
        expires: $key_expires
      },
      env_overrides: $env_overrides,
      worktree: {
        is_linked: $is_linked,
        main_worktree: (if $is_linked and ($main_wt | length > 0) then $main_wt else null end)
      },
      issues: $issues,
      matched_profile: (if $matched_profile == "null" then null else $matched_profile end)
    }')

  echo "$result"
}

cmd_discover() {
  # Parse GPG keys and git config to discover candidate profiles
  local gpg_keys
  gpg_keys=$(parse_gpg_keys)

  # Collect git config identities
  local git_names git_emails
  git_names=$(git config --get-all user.name 2>/dev/null || true)
  git_emails=$(git config --get-all user.email 2>/dev/null || true)
  # Also check global
  git_names="$git_names"$'\n'"$(git config --global --get-all user.name 2>/dev/null || true)"
  git_emails="$git_emails"$'\n'"$(git config --global --get-all user.email 2>/dev/null || true)"

  # Build candidate profiles from GPG keys (primary source)
  local candidates='[]'

  local key_count
  key_count=$(printf '%s' "$gpg_keys" | jq 'length')

  local i=0
  while [ "$i" -lt "$key_count" ]; do
    local key
    key=$(printf '%s' "$gpg_keys" | jq ".[$i]")
    local fpr validity expires
    fpr=$(printf '%s' "$key" | jq -r '.fingerprint')
    validity=$(printf '%s' "$key" | jq -r '.validity')
    expires=$(printf '%s' "$key" | jq -r '.expires')

    # Only include active keys
    local active
    active=$(is_key_active "$validity" "$expires")
    if [ "$active" = "true" ]; then
      local uid_count
      uid_count=$(printf '%s' "$key" | jq '.uids | length')
      local j=0
      while [ "$j" -lt "$uid_count" ]; do
        local uid_name uid_email
        uid_name=$(printf '%s' "$key" | jq -r ".uids[$j].name")
        uid_email=$(printf '%s' "$key" | jq -r ".uids[$j].email")

        if [ -n "$uid_email" ]; then
          # Generate profile ID from full email (replace @ and . with -)
          local profile_id
          profile_id=$(echo "$uid_email" | tr '@.' '-' | tr -cd 'a-zA-Z0-9-')

          # Check for duplicate email in candidates
          local dup
          dup=$(printf '%s' "$candidates" | jq --arg e "$uid_email" '[.[] | select(.email == $e)] | length')
          if [ "$dup" -eq 0 ]; then
            local exp_date
            exp_date=$(epoch_to_date "$expires")
            candidates=$(printf '%s' "$candidates" | jq \
              --arg id "$profile_id" \
              --arg n "$uid_name" \
              --arg e "$uid_email" \
              --arg fpr "$fpr" \
              --arg exp "$exp_date" \
              '. + [{"id": $id, "name": $n, "email": $e, "signingkey": $fpr, "gpg_format": "openpgp", "expires": $exp, "source": "auto-derived"}]')
          fi
        fi
        j=$((j + 1))
      done
    fi
    i=$((i + 1))
  done

  # If no GPG-derived candidates, try git config identities
  if [ "$(printf '%s' "$candidates" | jq 'length')" -eq 0 ]; then
    while IFS= read -r em; do
      [ -z "$em" ] && continue
      local nm
      nm=$(echo "$git_names" | head -1)
      [ -z "$nm" ] && nm="Unknown"
      local pid
      pid=$(echo "$em" | tr '@.' '-' | tr -cd 'a-zA-Z0-9-')
      candidates=$(printf '%s' "$candidates" | jq \
        --arg id "$pid" --arg n "$nm" --arg e "$em" \
        '. + [{"id": $id, "name": $n, "email": $e, "signingkey": "", "gpg_format": "openpgp", "expires": "n/a", "source": "git-config"}]')
    done <<< "$git_emails"
  fi

  # Persist to registry if candidates found
  local count
  count=$(printf '%s' "$candidates" | jq 'length')
  if [ "$count" -gt 0 ]; then
    local registry
    registry=$(read_registry)
    local idx=0
    while [ "$idx" -lt "$count" ]; do
      local c
      c=$(printf '%s' "$candidates" | jq ".[$idx]")
      local cid cname cemail ckey cfmt csrc
      cid=$(printf '%s' "$c" | jq -r '.id')
      cname=$(printf '%s' "$c" | jq -r '.name')
      cemail=$(printf '%s' "$c" | jq -r '.email')
      ckey=$(printf '%s' "$c" | jq -r '.signingkey')
      cfmt=$(printf '%s' "$c" | jq -r '.gpg_format')
      csrc=$(printf '%s' "$c" | jq -r '.source')
      registry=$(printf '%s' "$registry" | jq \
        --arg id "$cid" --arg n "$cname" --arg e "$cemail" \
        --arg k "$ckey" --arg f "$cfmt" --arg s "$csrc" \
        '.profiles[$id] = {name: $n, email: $e, signingkey: $k, gpg_format: $f, mru: null, source: $s}')
      idx=$((idx + 1))
    done
    write_registry "$registry"
  fi

  # Output candidates
  jq -n --argjson candidates "$candidates" --argjson count "$count" \
    '{candidates: $candidates, count: $count, registry_path: "'"$REGISTRY_FILE"'"}'
}

cmd_list() {
  local registry
  registry=$(read_registry)

  local repo_path
  repo_path=$(get_repo_path)

  local current_email
  current_email=$(git_cfg user.email)

  # Find active profile for this repo
  local active_id
  active_id=$(printf '%s' "$registry" | jq -r --arg rp "$repo_path" '.active_repos[$rp] // ""')

  # Build output with match indicators
  local profiles
  profiles=$(printf '%s' "$registry" | jq --arg aid "$active_id" --arg ce "$current_email" '
    [.profiles | to_entries[] | {
      id: .key,
      name: .value.name,
      email: .value.email,
      signingkey: (.value.signingkey | if length > 16 then (.[0:4] + "..." + .[-4:]) else . end),
      source: .value.source,
      mru: .value.mru,
      is_active: (.key == $aid),
      is_current_match: (.value.email == $ce)
    }]')

  local count
  count=$(printf '%s' "$profiles" | jq 'length')

  jq -n --argjson profiles "$profiles" --argjson count "$count" \
    --arg active_id "$active_id" \
    '{profiles: $profiles, count: $count, active_profile: (if $active_id == "" then null else $active_id end)}'
}

cmd_resolve() {
  local profile_id="${1:-}"
  [ -z "$profile_id" ] && json_error "Usage: resolve <profile-id>"

  local registry
  registry=$(read_registry)

  # Lookup profile
  local profile
  profile=$(printf '%s' "$registry" | jq --arg id "$profile_id" '.profiles[$id] // null')
  if [ "$profile" = "null" ]; then
    json_error "Unknown profile: $profile_id"
  fi

  local pname pemail pkey pfmt
  pname=$(printf '%s' "$profile" | jq -r '.name')
  pemail=$(printf '%s' "$profile" | jq -r '.email')
  pkey=$(printf '%s' "$profile" | jq -r '.signingkey')
  pfmt=$(printf '%s' "$profile" | jq -r '.gpg_format')

  local repo_path
  repo_path=$(get_repo_path)

  # Current values for comparison
  local cur_name cur_email cur_key cur_gpgsign
  cur_name=$(git_cfg user.name)
  cur_email=$(git_cfg user.email)
  cur_key=$(git_cfg user.signingkey)
  cur_gpgsign=$(git_cfg commit.gpgsign)

  # Build canonical plan JSON (deterministic for hashing)
  local plan
  plan=$(build_plan "$repo_path" "$pname" "$pemail" "$pkey" "$pfmt")

  local plan_hash
  plan_hash=$(compute_hash "$plan")

  # Check key status if signing key provided
  local key_warning=""
  if [ -n "$pkey" ]; then
    local gpg_keys
    gpg_keys=$(parse_gpg_keys)
    local matched
    matched=$(printf '%s' "$gpg_keys" | jq --arg sk "$pkey" '
      [.[] | select(.fingerprint == $sk or .keyid == $sk or
        (.fingerprint | endswith($sk)) or (.keyid | endswith($sk)))] | first // null')
    if [ "$matched" != "null" ] && [ -n "$matched" ]; then
      local kv ke
      kv=$(printf '%s' "$matched" | jq -r '.validity')
      ke=$(printf '%s' "$matched" | jq -r '.expires')
      local ks
      ks=$(key_status_str "$kv" "$ke")
      if [ "$ks" = "expired" ]; then
        key_warning="GPG key is expired"
      elif [ -n "$ke" ] && [ "$ke" != "0" ]; then
        local now days_left
        now=$(date +%s)
        days_left=$(( (ke - now) / 86400 ))
        if [ "$days_left" -lt 90 ] 2>/dev/null; then
          key_warning="GPG key expires in ${days_left} days"
        fi
      fi
    fi
  fi

  jq -n \
    --arg id "$profile_id" \
    --arg pname "$pname" \
    --arg pemail "$pemail" \
    --arg pkey "$pkey" \
    --arg pfmt "$pfmt" \
    --arg cur_name "$cur_name" \
    --arg cur_email "$cur_email" \
    --arg cur_key "$cur_key" \
    --arg cur_gpgsign "$cur_gpgsign" \
    --argjson plan "$plan" \
    --arg plan_hash "$plan_hash" \
    --arg key_warning "$key_warning" \
    '{
      profile_id: $id,
      profile: {name: $pname, email: $pemail, signingkey: $pkey, gpg_format: $pfmt},
      current: {name: $cur_name, email: $cur_email, signingkey: $cur_key, gpgsign: $cur_gpgsign},
      plan: $plan,
      plan_hash: $plan_hash,
      key_warning: (if $key_warning == "" then null else $key_warning end)
    }'
}

cmd_apply() {
  local plan_hash=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --plan-hash) plan_hash="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  [ -z "$plan_hash" ] && json_error "Usage: apply --plan-hash <hash>"

  # Re-read current state and find matching profile from registry
  local repo_path
  repo_path=$(get_repo_path)

  local registry
  registry=$(read_registry)

  local profile_ids
  profile_ids=$(printf '%s' "$registry" | jq -r '.profiles | keys[]')

  local matched_id="" matched_plan=""
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    local pname pemail pkey pfmt
    pname=$(printf '%s' "$registry" | jq -r --arg id "$pid" '.profiles[$id].name')
    pemail=$(printf '%s' "$registry" | jq -r --arg id "$pid" '.profiles[$id].email')
    pkey=$(printf '%s' "$registry" | jq -r --arg id "$pid" '.profiles[$id].signingkey')
    pfmt=$(printf '%s' "$registry" | jq -r --arg id "$pid" '.profiles[$id].gpg_format')

    local candidate_plan
    candidate_plan=$(build_plan "$repo_path" "$pname" "$pemail" "$pkey" "$pfmt")

    local candidate_hash
    candidate_hash=$(compute_hash "$candidate_plan")
    if [ "$candidate_hash" = "$plan_hash" ]; then
      matched_id="$pid"
      matched_plan="$candidate_plan"
      break
    fi
  done <<< "$profile_ids"

  if [ -z "$matched_id" ]; then
    json_error "Plan hash mismatch: no profile matches hash '$plan_hash'. Config may have changed. Re-run 'resolve' to get a fresh plan."
  fi

  # Backup current .git/config
  local git_dir_path
  git_dir_path=$(git rev-parse --git-dir 2>/dev/null)
  local backup_path="${git_dir_path}/.config_backup_$(date +%s)"
  if [ -f "${git_dir_path}/config" ]; then
    cp "${git_dir_path}/config" "$backup_path" 2>/dev/null || true
  fi

  # Apply config
  local pname pemail pkey pfmt
  pname=$(printf '%s' "$registry" | jq -r --arg id "$matched_id" '.profiles[$id].name')
  pemail=$(printf '%s' "$registry" | jq -r --arg id "$matched_id" '.profiles[$id].email')
  pkey=$(printf '%s' "$registry" | jq -r --arg id "$matched_id" '.profiles[$id].signingkey')
  pfmt=$(printf '%s' "$registry" | jq -r --arg id "$matched_id" '.profiles[$id].gpg_format')

  git config --local user.name "$pname" || json_error "Failed to set user.name"
  git config --local user.email "$pemail" || json_error "Failed to set user.email"
  if [ -n "$pkey" ]; then
    git config --local user.signingkey "$pkey" || json_error "Failed to set user.signingkey"
    git config --local commit.gpgsign true || json_error "Failed to set commit.gpgsign"
    git config --local gpg.format "$pfmt" || json_error "Failed to set gpg.format"
  else
    # Clear signing config when switching to a keyless profile
    git config --local --unset user.signingkey 2>/dev/null || true
    git config --local --unset commit.gpgsign 2>/dev/null || true
    git config --local --unset gpg.format 2>/dev/null || true
  fi

  # Verify effective config
  local eff_name eff_email eff_key
  eff_name=$(git_cfg user.name)
  eff_email=$(git_cfg user.email)
  eff_key=$(git_cfg user.signingkey)

  local verified=true
  [ "$eff_name" != "$pname" ] && verified=false
  [ "$eff_email" != "$pemail" ] && verified=false
  if [ -n "$pkey" ] && [ "$eff_key" != "$pkey" ]; then
    verified=false
  fi

  # Update registry: MRU + active_repos
  local now_iso
  now_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  registry=$(printf '%s' "$registry" | jq \
    --arg id "$matched_id" --arg rp "$repo_path" --arg mru "$now_iso" \
    '.profiles[$id].mru = $mru | .active_repos[$rp] = $id')
  write_registry "$registry"

  jq -n \
    --arg id "$matched_id" \
    --argjson verified "$verified" \
    --arg eff_name "$eff_name" \
    --arg eff_email "$eff_email" \
    --arg eff_key "$eff_key" \
    --arg backup "$backup_path" \
    '{
      applied: true,
      profile_id: $id,
      verified: $verified,
      effective: {name: $eff_name, email: $eff_email, signingkey: $eff_key},
      backup_path: $backup
    }'
}

cmd_remove_check() {
  local profile_id="${1:-}"
  [ -z "$profile_id" ] && json_error "Usage: remove-check <profile-id>"

  local registry
  registry=$(read_registry)

  # Check if profile exists
  local profile
  profile=$(printf '%s' "$registry" | jq --arg id "$profile_id" '.profiles[$id] // null')
  if [ "$profile" = "null" ]; then
    json_error "Unknown profile: $profile_id"
  fi

  # Find active repos using this profile
  local active_repos
  active_repos=$(printf '%s' "$registry" | jq --arg id "$profile_id" '
    [.active_repos | to_entries[] | select(.value == $id) | .key]')

  local active_count
  active_count=$(printf '%s' "$active_repos" | jq 'length')

  jq -n \
    --arg id "$profile_id" \
    --argjson profile "$profile" \
    --argjson active_repos "$active_repos" \
    --argjson active_count "$active_count" \
    '{
      profile_id: $id,
      profile: $profile,
      active_repos: $active_repos,
      active_count: $active_count,
      safe_to_remove: ($active_count == 0)
    }'
}

cmd_remove_exec() {
  local profile_id="${1:-}"
  local force=false
  shift || true
  while [ $# -gt 0 ]; do
    case "$1" in
      --force) force=true; shift ;;
      *) shift ;;
    esac
  done
  [ -z "$profile_id" ] && json_error "Usage: remove-exec <profile-id> [--force]"

  local registry
  registry=$(read_registry)

  # Check exists
  local profile
  profile=$(printf '%s' "$registry" | jq --arg id "$profile_id" '.profiles[$id] // null')
  if [ "$profile" = "null" ]; then
    json_error "Unknown profile: $profile_id"
  fi

  # Check active
  local active_count
  active_count=$(printf '%s' "$registry" | jq --arg id "$profile_id" '
    [.active_repos | to_entries[] | select(.value == $id)] | length')

  if [ "$active_count" -gt 0 ] && [ "$force" = "false" ]; then
    json_error "Profile '$profile_id' is active in $active_count repo(s). Use --force to remove anyway."
  fi

  # Remove from profiles and active_repos
  registry=$(printf '%s' "$registry" | jq --arg id "$profile_id" '
    del(.profiles[$id]) |
    .active_repos = (.active_repos | to_entries | map(select(.value != $id)) | from_entries)')

  write_registry "$registry"

  jq -n --arg id "$profile_id" --argjson force "$force" \
    '{removed: true, profile_id: $id, forced: $force}'
}

cmd_verify() {
  local issues="[]"
  local overall_status="ok"

  # 1. Run doctor first for base diagnostics
  local diag
  diag=$(cmd_doctor --json 2>/dev/null || echo '{"status":"halt","issues":[]}')

  # Import doctor issues
  issues=$(printf '%s' "$diag" | jq '.issues')
  overall_status=$(printf '%s' "$diag" | jq -r '.status')

  local signingkey
  signingkey=$(git_cfg user.signingkey)
  local email
  email=$(git_cfg user.email)

  # 2. Key expiry check (90-day warning)
  if [ -n "$signingkey" ]; then
    local gpg_keys
    gpg_keys=$(parse_gpg_keys)
    local matched
    matched=$(printf '%s' "$gpg_keys" | jq --arg fpr "$signingkey" '
      [.[] | select(.fingerprint == $fpr or .keyid == $fpr or
        (.fingerprint | endswith($fpr)) or (.keyid | endswith($fpr)))] | first // null')
    if [ "$matched" != "null" ] && [ -n "$matched" ]; then
      local ke
      ke=$(printf '%s' "$matched" | jq -r '.expires')
      if [ -n "$ke" ] && [ "$ke" != "0" ]; then
        local now days_left
        now=$(date +%s)
        days_left=$(( (ke - now) / 86400 )) 2>/dev/null || days_left=999
        if [ "$days_left" -lt 90 ] && [ "$days_left" -gt 0 ]; then
          issues=$(printf '%s' "$issues" | jq --argjson d "$days_left" \
            '. + [{"severity":"warn","code":"KEY_EXPIRING_SOON","message":("GPG key expires in " + ($d|tostring) + " days")}]')
          [ "$overall_status" = "ok" ] && overall_status="warn"
        fi
      fi

      # 3. Email match check
      local key_emails
      key_emails=$(printf '%s' "$matched" | jq -r '[.uids[].email] | join(",")')
      if [ -n "$email" ] && [ -n "$key_emails" ]; then
        if ! echo ",$key_emails," | grep -Fq ",$email,"; then
          issues=$(printf '%s' "$issues" | jq --arg e "$email" \
            '. + [{"severity":"warn","code":"EMAIL_MISMATCH","message":("Git email " + $e + " does not match any GPG key UID")}]')
          [ "$overall_status" = "ok" ] && overall_status="warn"
        fi
      fi
    fi
  fi

  # 4. Registry consistency
  if [ -f "$REGISTRY_FILE" ]; then
    local repo_path
    repo_path=$(get_repo_path)
    local reg_profile
    reg_profile=$(jq -r --arg rp "$repo_path" '.active_repos[$rp] // ""' "$REGISTRY_FILE" 2>/dev/null || echo "")
    if [ -n "$reg_profile" ]; then
      local reg_email
      reg_email=$(jq -r --arg id "$reg_profile" '.profiles[$id].email // ""' "$REGISTRY_FILE" 2>/dev/null || echo "")
      if [ -n "$reg_email" ] && [ "$reg_email" != "$email" ]; then
        issues=$(printf '%s' "$issues" | jq --arg id "$reg_profile" --arg re "$reg_email" --arg ce "$email" \
          '. + [{"severity":"warn","code":"REGISTRY_MISMATCH","message":("Registry profile " + $id + " has email " + $re + " but git config has " + $ce)}]')
        [ "$overall_status" = "ok" ] && overall_status="warn"
      fi
    fi
  fi

  jq -n --arg status "$overall_status" --argjson issues "$issues" \
    '{version: 1, status: $status, issues: $issues, checks_run: ["identity","signing","key_expiry","email_match","registry_consistency"]}'
}

# --- Main ---
SUBCOMMAND="${1:-doctor}"
shift || true

case "$SUBCOMMAND" in
  doctor)       cmd_doctor "$@" ;;
  discover)     cmd_discover "$@" ;;
  list)         cmd_list "$@" ;;
  resolve)      cmd_resolve "$@" ;;
  apply)        cmd_apply "$@" ;;
  remove-check) cmd_remove_check "$@" ;;
  remove-exec)  cmd_remove_exec "$@" ;;
  verify)       cmd_verify "$@" ;;
  *)            echo '{"error":"Unknown subcommand: '"$SUBCOMMAND"'"}' >&2; exit 1 ;;
esac
