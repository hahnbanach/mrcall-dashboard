#!/usr/bin/env bash
# Uploads a built and precompressed dist/ to the dashboard's bucket, keeping the assets of earlier releases for a
# retention period (plan docs/execution-plans/2026-10-23-dashboard-load.md, M5). The workflow runs it after
# scripts/precompress.sh; the rehearsal runs the same file against a local S3-compatible endpoint.
#
#   scripts/deploy-assets.sh --endpoint URL --bucket NAME --cache-control VALUE --retention-days N --dist DIR
#
# Every argument is required, with no default, so that a deploy never goes somewhere by omission.
#
# --cache-control is the Cache-Control of the hashed assets (js/, css/, fonts/, img/): `public, max-age=60` for the
# probe, `public, max-age=31536000, immutable` once the edge is known to keep it, or the literal `none` for no header
# (the behaviour before this script). Unset or empty, the script stops before uploading anything.
#
# Why each step is where it is:
# - Encoding. Neither the bucket nor Scaleway Edge Services negotiates encodings: an object is served with the
#   encoding it was stored with. Every .js and .css is therefore stored as gzip (precompress.sh did it) and declared
#   `Content-Encoding: gzip`; gzip and not brotli because, without negotiation, the one stored encoding must be one
#   every browser accepts. Nothing else is encoded. The script checks the gzip magic bytes first, so a dist that
#   skipped precompress.sh can never go up declared as gzip.
# - Order. A page must never name an asset that is not there yet: assets first, index.html and its route copies last.
# - Retention. Every page is loaded on demand, so a tab opened before a deploy asks for chunks that only the release
#   it was opened on has. They are kept until 14 days (the retention) after the deploy that took them out of service,
#   recorded in deploy-manifests/. Never "not named by index.html": lazy chunks are named only by the runtime.
# - Headers again. Every asset is uploaded with `cp`, not `sync`, so that a redeploy of the same build with another
#   --cache-control rewrites every header (`sync` would skip objects of the same size and date).
set -euo pipefail

usage() { echo "usage: $0 --endpoint URL --bucket NAME --cache-control VALUE --retention-days N --dist DIR" >&2; exit 2; }
endpoint="" bucket="" cache_control="" retention_days="" dist=""
while [ $# -gt 0 ]; do
  case "$1" in
    --endpoint) endpoint="${2:-}"; shift 2 ;;
    --bucket) bucket="${2:-}"; shift 2 ;;
    --cache-control) cache_control="${2:-}"; shift 2 ;;
    --retention-days) retention_days="${2:-}"; shift 2 ;;
    --dist) dist="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done
[ -n "$endpoint" ] && [ -n "$bucket" ] && [ -n "$retention_days" ] && [ -n "$dist" ] || usage
if [ -z "$cache_control" ]; then
  echo "--cache-control is empty: set ASSET_CACHE_CONTROL on the environment ('none' for no header)" >&2
  exit 2
fi
[[ "$retention_days" =~ ^[0-9]+$ ]] || { echo "--retention-days must be a whole number of days" >&2; exit 2; }
[ -f "$dist/index.html" ] || { echo "$dist/index.html not found" >&2; exit 2; }

s3="s3://$bucket"
aws_s3() { aws --endpoint-url "$endpoint" "$@"; }
# expanded as ${asset_cache[@]+...}: an empty array is "unbound" under set -u in bash before 4.4 (macOS has 3.2)
asset_cache=()
[ "$cache_control" != "none" ] && asset_cache=(--cache-control "$cache_control")
HASHED='^(js|css|fonts|img)/'
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
now_epoch="$(date -u +%s)"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
echo "deploy-assets: $dist -> $s3 at $endpoint, asset Cache-Control: $cache_control, retention $retention_days days"

# 0. Every .js and .css must be gzip already.
while IFS= read -r -d '' file; do
  if [ "$(head -c 2 "$file" | od -An -tx1 | tr -d ' \n')" != "1f8b" ]; then
    echo "not gzip: $file. Run scripts/precompress.sh first." >&2
    exit 1
  fi
done < <(find "$dist" -type f \( -name '*.js' -o -name '*.css' \) -print0)

# The keys involved: this build's hashed keys, the bucket's, the previous current.txt, the retained lists.
(cd "$dist" && find . -type f | sed 's#^\./##' | sort) > "$work/build.txt"
grep -E "$HASHED" "$work/build.txt" > "$work/build-hashed.txt" || true
# A failed listing stops the deploy: nothing has been written yet, and retention cannot be decided without it.
aws_s3 s3api list-objects-v2 --bucket "$bucket" --query 'Contents[].Key' --output text > "$work/bucket-raw.txt"
tr '\t' '\n' < "$work/bucket-raw.txt" | grep -v '^None$' | grep -v '^$' | sort > "$work/bucket.txt" || true
grep -E "$HASHED" "$work/bucket.txt" > "$work/bucket-hashed.txt" || true
if grep -qx 'deploy-manifests/current.txt' "$work/bucket.txt"; then
  aws_s3 s3 cp "$s3/deploy-manifests/current.txt" "$work/previous-current.txt" --only-show-errors
else
  : > "$work/previous-current.txt"
fi
sort -o "$work/previous-current.txt" "$work/previous-current.txt"
mkdir -p "$work/lists"
for key in $(grep -E '^deploy-manifests/superseded-[0-9]{8}T[0-9]{6}Z\.txt$' "$work/bucket.txt" || true); do
  aws_s3 s3 cp "$s3/$key" "$work/lists/$(basename "$key")" --only-show-errors
done
cat "$work"/lists/*.txt 2>/dev/null | sort -u > "$work/listed.txt" || : > "$work/listed.txt"

# 1. What this deploy takes out of service: the previous current keys not in this build, and orphans (hashed keys in
#    the bucket that no record accounts for: the release live before this scheme, or a deploy interrupted before
#    step 5). Orphans are retained like any superseded key, never deleted unseen.
comm -23 "$work/previous-current.txt" "$work/build-hashed.txt" > "$work/left.txt"
comm -23 "$work/bucket-hashed.txt" "$work/build-hashed.txt" | comm -23 - "$work/previous-current.txt" \
  | comm -23 - "$work/listed.txt" > "$work/orphans.txt"
sort -u "$work/left.txt" "$work/orphans.txt" > "$work/superseded.txt"
echo "step 1: $(wc -l < "$work/superseded.txt" | tr -d ' ') keys leave service ($(wc -l < "$work/orphans.txt" | tr -d ' ') orphans)"
if [ -s "$work/superseded.txt" ]; then
  aws_s3 s3 cp "$work/superseded.txt" "$s3/deploy-manifests/superseded-$stamp.txt" \
    --content-type text/plain --cache-control no-cache --only-show-errors
fi

# 2. The assets, nothing deleted. Hashed .js and .css: gzip, the asset cache header. Other hashed files: raw, the
#    asset cache header. A .js or .css outside the hashed prefixes carries no hash: gzip, but no-cache, or a change to
#    it would never reach a browser.
echo "step 2: assets -> $s3"
aws_s3 s3 cp "$dist/" "$s3/" --recursive --only-show-errors \
  --exclude '*' --include 'js/*.js' --include 'css/*.css' \
  --content-encoding gzip ${asset_cache[@]+"${asset_cache[@]}"}
aws_s3 s3 cp "$dist/" "$s3/" --recursive --only-show-errors \
  --exclude '*' --include 'js/*' --include 'css/*' --include 'fonts/*' --include 'img/*' \
  --exclude '*.js' --exclude '*.css' ${asset_cache[@]+"${asset_cache[@]}"}
aws_s3 s3 cp "$dist/" "$s3/" --recursive --only-show-errors \
  --exclude '*' --include '*.js' --include '*.css' \
  --exclude 'js/*' --exclude 'css/*' --exclude 'fonts/*' --exclude 'img/*' \
  --content-encoding gzip --cache-control no-cache

# 3. The rest of the site, deleting what the build no longer has, except what other steps own: the assets (pruned in
#    step 6), index.html and the route keys (step 4; the route copies are not in dist/, so --delete would remove them
#    and leave deep links on 404 for the seconds until step 4), and the manifests. An excluded key is neither uploaded
#    nor deleted.
echo "step 3: the rest -> $s3"
routes="$(node "$(dirname "$0")/static-routes.js" | sed 's#^/##')"
route_excludes=()
for route in $routes; do route_excludes+=(--exclude "$route"); done
aws_s3 s3 sync "$dist/" "$s3/" --delete --only-show-errors \
  --exclude 'js/*' --exclude 'css/*' --exclude 'fonts/*' --exclude 'img/*' \
  --exclude '*.js' --exclude '*.css' --exclude 'index.html' --exclude 'deploy-manifests/*' \
  ${route_excludes[@]+"${route_excludes[@]}"}

# 4. index.html and its route copies, last, raw and no-cache: the bucket answers a key it does not hold with
#    index.html under 404, so every route without a parameter gets a copy of its own (scripts/static-routes.js).
echo "step 4: index.html and $(echo "$routes" | grep -c . | tr -d ' ') route copies -> $s3"
# eight at a time, as the workflow did before this script
printf '%s\n' index.html $routes | xargs -P 8 -I{} \
  aws --endpoint-url "$endpoint" s3 cp "$dist/index.html" "$s3/{}" --content-type text/html --cache-control no-cache --only-show-errors

# 5. The live release's hashed keys, once index.html names them.
aws_s3 s3 cp "$work/build-hashed.txt" "$s3/deploy-manifests/current.txt" \
  --content-type text/plain --cache-control no-cache --only-show-errors
echo "step 5: current.txt holds $(wc -l < "$work/build-hashed.txt" | tr -d ' ') keys"

# 6. Prune. A .js or .css outside the hashed prefixes that the build no longer has goes at once (no hash, nothing to
#    retain). A hashed key the build no longer has goes when the newest list naming it is older than the retention;
#    a key no list names is reported and left (after step 1 only a concurrent writer can make one). Then the lists
#    older than the retention go: each of their keys is by then deleted, current again, or named by a newer list.
cp "$work/superseded.txt" "$work/lists/superseded-$stamp.txt" 2>/dev/null || true
[ -s "$work/lists/superseded-$stamp.txt" ] || rm -f "$work/lists/superseded-$stamp.txt"
to_epoch() { local s="$1"; date -u -j -f '%Y%m%dT%H%M%SZ' "$s" +%s 2>/dev/null || date -u -d "${s:0:8} ${s:9:2}:${s:11:2}:${s:13:2}" +%s; }
cutoff=$(( now_epoch - retention_days * 86400 ))
deleted=0 kept=0 strays=0
# (grep finds nothing on most deploys and returns 1: under pipefail that alone would stop the script)
{ comm -23 "$work/bucket.txt" "$work/build.txt" | grep -Ev "$HASHED" | grep -E '\.(js|css)$' || true; } > "$work/unhashed-gone.txt"
while read -r key; do
  [ -n "$key" ] || continue
  echo "step 6: delete unhashed $key"; aws_s3 s3 rm "$s3/$key" --only-show-errors
done < "$work/unhashed-gone.txt"
while read -r key; do
  [ -n "$key" ] || continue
  newest=""
  for list in "$work"/lists/superseded-*.txt; do
    [ -e "$list" ] || continue
    if grep -qxF "$key" "$list"; then
      name="$(basename "$list" .txt)"; ts="${name#superseded-}"
      [ -z "$newest" ] || [[ "$ts" > "$newest" ]] && newest="$ts"
    fi
  done
  if [ -z "$newest" ]; then
    echo "step 6: stray $key (no list names it), left in place"; strays=$((strays + 1))
  elif [ "$(to_epoch "$newest")" -lt "$cutoff" ]; then
    aws_s3 s3 rm "$s3/$key" --only-show-errors; deleted=$((deleted + 1))
  else
    kept=$((kept + 1))
  fi
done < <(comm -23 "$work/bucket-hashed.txt" "$work/build-hashed.txt")
for list in "$work"/lists/superseded-*.txt; do
  [ -e "$list" ] || continue
  name="$(basename "$list" .txt)"; ts="${name#superseded-}"
  if [ "$(to_epoch "$ts")" -lt "$cutoff" ]; then
    aws_s3 s3 rm "$s3/deploy-manifests/$name.txt" --only-show-errors
    echo "step 6: list $name.txt aged out"
  fi
done
echo "step 6: $deleted superseded keys deleted, $kept retained, $strays strays"
