#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") -m "message"    create next tag, push branch, ask for env tags
       $(basename "$0") -p              publish missing env tags for the latest tag

Options:
  -m, --message   Message for the new tag
  -p, --publish   Publish missing -test/-beta/-production tags for the latest tag
  -h, --help      Show this help
EOF
  exit 0
}

die() { echo "Error: $*" >&2; exit 1; }

# ask_yes_no PROMPT -> returns 0 on yes.
# Normalizes the answer: strips ALL whitespace (incl. CR) and lowercases it,
# so "y", "Y", "y\r", " yes " all count as yes. EOF counts as no.
ask_yes_no() {
  local resp
  read -rp "$1" resp || resp=""
  resp="$(printf '%s' "$resp" | tr -d '[:space:]')"
  resp="${resp,,}"
  [[ "$resp" == "y" || "$resp" == "yes" ]]
}

[[ $# -gt 0 ]] || usage

MODE=""
MESSAGE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      [[ -n "${2:-}" ]] || die "-m/--message requires an argument"
      MESSAGE="$2"
      shift 2
      ;;
    -p|--publish)
      MODE="publish"
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

if [[ "$MODE" == "publish" ]]; then
  [[ -z "$MESSAGE" ]] || die "-m/--message cannot be combined with -p/--publish"
else
  [[ -n "$MESSAGE" ]] || die "-m/--message is required (or use -p/--publish)"
fi

# Origin is the source of truth for tags: sync local tags with it, pruning
# local tags that no longer exist remotely, so "latest" is never stale and a
# tag left over from a half-failed run cannot poison the numbering.
git fetch --tags --prune --prune-tags origin

# Enumerate tags newest-first, pipe-free. LATEST_ANY is the newest tag of any
# kind; LATEST_BASE is the newest bare release tag (vX.Y.Z, no env suffix).
LATEST_ANY=""
LATEST_BASE=""
while IFS= read -r t; do
  if [[ -z "$LATEST_ANY" ]]; then
    LATEST_ANY="$t"
  fi
  if [[ -z "$LATEST_BASE" && "$t" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    LATEST_BASE="$t"
  fi
done < <(git for-each-ref refs/tags --sort=-v:refname --format='%(refname:short)')

[[ -n "$LATEST_ANY" ]] || die "no tags found in this repository"

# Strip an env suffix from the newest tag to get its base (v2.0.23-beta -> v2.0.23)
BASE_TAG="$LATEST_ANY"
case "$LATEST_ANY" in
  *-test)       BASE_TAG="${LATEST_ANY%-test}" ;;
  *-beta)       BASE_TAG="${LATEST_ANY%-beta}" ;;
  *-production) BASE_TAG="${LATEST_ANY%-production}" ;;
esac

if [[ "$MODE" == "publish" ]]; then
  echo "Latest tag: $BASE_TAG"
  for ENV in test beta production; do
    ENV_TAG="$BASE_TAG-$ENV"
    if git rev-parse -q --verify "refs/tags/$ENV_TAG" >/dev/null; then
      echo "  $ENV_TAG exists, skipping"
      continue
    fi
    if ask_yes_no "Create and push $ENV_TAG? (y/N) "; then
      BASE_MSG="$(git for-each-ref "refs/tags/$BASE_TAG" --format='%(contents)')"
      git tag -a "$ENV_TAG" -m "$BASE_MSG"
      git push origin "$ENV_TAG"
      echo "  Pushed $ENV_TAG"
    else
      echo "  Skipping $ENV"
    fi
  done
else
  [[ -n "$LATEST_BASE" ]] || die "no vX.Y.Z release tag found"
  [[ "$LATEST_BASE" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]
  NEW_TAG="v${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.$((BASH_REMATCH[3] + 1))"
  if git rev-parse -q --verify "refs/tags/$NEW_TAG" >/dev/null; then
    die "tag $NEW_TAG already exists"
  fi
  git tag -a "$NEW_TAG" -m "$MESSAGE"
  echo "Created tag $NEW_TAG"
  BRANCH="$(git branch --show-current)"
  [[ -n "$BRANCH" ]] || die "detached HEAD, cannot determine branch to push"
  git push origin "$BRANCH"
  git push origin "$NEW_TAG"
  echo "Pushed branch '$BRANCH' and tag '$NEW_TAG'"
  for ENV in test beta production; do
    if ask_yes_no "Push $ENV ($NEW_TAG-$ENV)? (y/N) "; then
      ENV_TAG="$NEW_TAG-$ENV"
      git tag -a "$ENV_TAG" -m "$MESSAGE"
      git push origin "$ENV_TAG"
      echo "  Pushed $ENV_TAG"
    else
      echo "  Skipping $ENV"
    fi
  done
fi

echo "Done."
