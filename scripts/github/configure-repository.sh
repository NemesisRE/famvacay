#!/usr/bin/env bash
# Applies the GitHub repository settings that cannot live in files: description, merge options,
# security features, Actions permissions and the rulesets in .github/rulesets/.
# Idempotent: run it again after changing a ruleset file.
#
# Needs a token with admin rights on the repository (classic token with `repo` scope, or a
# fine-grained token with "Administration: read and write"), for example after
# `gh auth login --web`.
set -euo pipefail

REPO="${REPO:-NemesisRE/famvacay}"
cd "$(dirname "$0")/../.."

echo "Repository details and merge options"
gh repo edit "$REPO" \
  --description "Family vacation planner that finds the best travel windows around school holidays, public holidays, weather and prices. Self-hosted, GDPR-friendly." \
  --add-topic vacation-planner,family,travel,school-holidays,public-holidays,self-hosted,gdpr,nextjs,typescript,prisma \
  --enable-wiki=false \
  --enable-projects=false \
  --enable-squash-merge \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --enable-auto-merge \
  --delete-branch-on-merge

# Squash commits use the (conventional) PR title, which drives the release labels
gh api -X PATCH "repos/$REPO" \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY \
  -F allow_update_branch=true \
  --silent

echo "Security features"
gh api -X PUT "repos/$REPO/vulnerability-alerts" --silent
gh api -X PUT "repos/$REPO/private-vulnerability-reporting" --silent
gh api -X PATCH "repos/$REPO" --silent --input - <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON

echo "Actions: read-only token by default (jobs request what they need); the data-sync"
echo "workflow needs to open pull requests"
gh api -X PUT "repos/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=true \
  --silent

echo "Rulesets"
for file in .github/rulesets/*.json; do
  name="$(node -p "require('./$file').name")"
  id="$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name == \"$name\") | .id")"
  if [[ -n "$id" ]]; then
    gh api -X PUT "repos/$REPO/rulesets/$id" --input "$file" --silent
    echo "  updated $name"
  else
    gh api -X POST "repos/$REPO/rulesets" --input "$file" --silent
    echo "  created $name"
  fi
done

echo "Done."
