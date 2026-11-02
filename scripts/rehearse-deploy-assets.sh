#!/usr/bin/env bash
# Rehearsal of scripts/deploy-assets.sh against a local S3 emulator (plan docs/execution-plans/2026-10-23-dashboard-load.md,
# M5, "Rehearsal"). It proves the script, not the edge: the edge is the probe's job (M9 step 2).
#
#   scripts/rehearse-deploy-assets.sh <base dist> <candidate dist>
#
# Both dist directories are production builds, not yet precompressed (the rehearsal copies and precompresses them).
# Needs `moto_server` (pipx install "moto[server]") and the AWS CLI. The plan named MinIO; on 2026-11-02 neither Docker
# Hub nor quay.io served its image anonymously, and moto's S3 keeps Content-Encoding, Cache-Control and listings, which
# is what is checked here. Credentials are invented for the emulator and exist only in this process's environment.
set -euo pipefail

base_src="${1:?base dist}"; cand_src="${2:?candidate dist}"
here="$(cd "$(dirname "$0")" && pwd)"
port=19000; endpoint="http://127.0.0.1:$port"; bucket=rehearsal
export AWS_ACCESS_KEY_ID=rehearsal AWS_SECRET_ACCESS_KEY="rehearsal-$RANDOM" AWS_DEFAULT_REGION=us-east-1
work="$(mktemp -d)"
moto_server -p "$port" > "$work/moto.log" 2>&1 &
moto=$!
trap 'kill $moto 2>/dev/null; rm -rf "$work"' EXIT
for _ in $(seq 1 50); do curl -s "$endpoint" > /dev/null && break; sleep 0.2; done
s3() { aws --endpoint-url "$endpoint" "$@"; }
s3 s3 mb "s3://$bucket" > /dev/null

failures=0
check() { if eval "$2"; then echo "  ok   $1"; else echo "  FAIL $1"; failures=$((failures + 1)); fi; }
head_of() { s3 s3api head-object --bucket "$bucket" --key "$1" --output json 2>/dev/null; }
field() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$1') or '')"; }
keys() { s3 s3api list-objects-v2 --bucket "$bucket" --query 'Contents[].Key' --output text | tr '\t' '\n' | grep -v '^None$' | sort; }
count() { keys | grep -c . || true; }

prepare() { rm -rf "$2"; cp -R "$1" "$2"; "$here/precompress.sh" "$2" > /dev/null; }
prepare "$base_src" "$work/base"
prepare "$cand_src" "$work/cand"
# A chunk of its own for a build: gzip bytes, as precompress.sh leaves every .js
own() { printf 'window.%s=1\n' "$2" | gzip -9 -n > "$1/js/$2.$(printf '%s' "$2" | shasum | cut -c1-8).js"; }
deploy() { "$here/deploy-assets.sh" --endpoint "$endpoint" --bucket "$bucket" --cache-control "$2" --retention-days 14 --dist "$1"; }

echo "== the bucket filled as today's workflow fills it (v2.2.47's three syncs), with the base build"
s3 s3 sync "$work/base/" "s3://$bucket" --exclude '*' --include '*.js' --include '*.css' --content-encoding gzip --only-show-errors
s3 s3 sync "$work/base/" "s3://$bucket" --delete --exclude '*.js' --exclude '*.css' --only-show-errors
echo "   objects: $(count)"

echo "== deploy the candidate, probe header"
routes="$(node "$here/static-routes.js" | sed 's#^/##')"
probe_route="$(echo "$routes" | head -1)"
s3 s3 cp "$work/cand/index.html" "s3://$bucket/$probe_route" --content-type text/html --only-show-errors
( absent=0; while [ ! -f "$work/stop" ]; do head_of "$probe_route" > /dev/null || absent=$((absent + 1)); sleep 0.05; done; echo "$absent" > "$work/absent" ) &
poller=$!
deploy "$work/cand" "public, max-age=60" | tee "$work/log1"
touch "$work/stop"; wait $poller
js="$(cd "$work/cand" && ls js/app.*.js | head -1)"; css="$(cd "$work/cand" && ls css/app.*.css | head -1)"
font="$(cd "$work/cand" && ls fonts/* 2>/dev/null | head -1)"; svg="$(cd "$work/cand" && ls img/*.svg 2>/dev/null | head -1)"
check "js: gzip, probe cache" '[ "$(head_of "$js" | field ContentEncoding)" = gzip ] && [ "$(head_of "$js" | field CacheControl)" = "public, max-age=60" ]'
check "js: content type" 'head_of "$js" | field ContentType | grep -q javascript'
check "css: gzip, probe cache" '[ "$(head_of "$css" | field ContentEncoding)" = gzip ] && [ "$(head_of "$css" | field CacheControl)" = "public, max-age=60" ]'
check "font: raw, probe cache" '[ -z "$font" ] || { [ -z "$(head_of "$font" | field ContentEncoding)" ] && [ "$(head_of "$font" | field CacheControl)" = "public, max-age=60" ]; }'
check "svg: raw, probe cache" '[ -z "$svg" ] || { [ -z "$(head_of "$svg" | field ContentEncoding)" ] && [ "$(head_of "$svg" | field CacheControl)" = "public, max-age=60" ]; }'
check "root bundle: gzip, no-cache" '[ "$(head_of MrCallWebCall.bundle.js | field ContentEncoding)" = gzip ] && [ "$(head_of MrCallWebCall.bundle.js | field CacheControl)" = no-cache ]'
check "index.html and every route key: html, no-cache" 'for k in index.html $routes; do [ "$(head_of "$k" | field CacheControl)" = no-cache ] && head_of "$k" | field ContentType | grep -q text/html || exit 1; done'
check "decoded js equals the build" 's3 s3 cp "s3://$bucket/$js" - | gzip -dc | cmp -s - <(gzip -dc "$work/cand/$js")'
check "no .gz or .br key" '! keys | grep -qE "\.(gz|br)$"'
check "current.txt is the build's hashed keys" 'diff <(s3 s3 cp "s3://$bucket/deploy-manifests/current.txt" -) <(cd "$work/cand" && find js css fonts img -type f 2>/dev/null | sort) > /dev/null'
check "step 1 listed the base's hashed keys the candidate lacks (all orphans: no current.txt before)" \
  'list="$(keys | grep superseded- | head -1)"; diff <(s3 s3 cp "s3://$bucket/$list" -) <(comm -23 <(cd "$work/base" && find js css fonts img -type f 2>/dev/null | grep -vE "\.(gz|br)$" | sort) <(cd "$work/cand" && find js css fonts img -type f 2>/dev/null | sort)) > /dev/null'
check "the base's superseded assets are still there (retained)" 'keys | grep -qxF "$(cd "$work/base" && ls js/app.*.js | head -1)"'
check "every asset step logged before index.html" '[ "$(grep -n "^step 2" "$work/log1" | cut -d: -f1)" -lt "$(grep -n "^step 4" "$work/log1" | cut -d: -f1)" ]'
check "the route key was never absent during the deploy" '[ "$(cat "$work/absent")" = 0 ]'

echo "== header-only redeploys of the same build"
before="$(count)"; manifests="$(keys | grep deploy-manifests/ | tr '\n' ' ')"
deploy "$work/cand" "public, max-age=31536000, immutable" > "$work/log2"
check "immutable on every hashed key" 'for k in $(cd "$work/cand" && find js css fonts img -type f | head -40); do [ "$(head_of "$k" | field CacheControl)" = "public, max-age=31536000, immutable" ] || exit 1; done'
deploy "$work/cand" none > "$work/log3"
check "none: no Cache-Control on the hashed keys" 'for k in $(cd "$work/cand" && find js css -type f | head -20); do [ -z "$(head_of "$k" | field CacheControl)" ] || exit 1; done'
check "nothing deleted, manifests unchanged" '[ "$(count)" = "$before" ] && [ "$(keys | grep deploy-manifests/ | tr "\n" " ")" = "$manifests" ]'
check "required argument: empty cache value stops before uploading" '! "$here/deploy-assets.sh" --endpoint "$endpoint" --bucket "$bucket" --cache-control "" --retention-days 14 --dist "$work/cand" 2>/dev/null'
check "a dist that skipped precompress stops" 'cp -R "$cand_src" "$work/raw" && ! deploy "$work/raw" none > /dev/null 2>&1'

echo "== retention over time, with backdated lists"
s3 s3 rm "s3://$bucket" --recursive --only-show-errors
s3 s3 sync "$work/base/" "s3://$bucket" --exclude '*' --include '*.js' --include '*.css' --content-encoding gzip --only-show-errors
s3 s3 sync "$work/base/" "s3://$bucket" --delete --exclude '*.js' --exclude '*.css' --only-show-errors
for b in B1 B2 B3 B4 B5; do rm -rf "$work/$b"; cp -R "$work/cand" "$work/$b"; done
own "$work/B1" b1own; own "$work/B2" b2own; own "$work/B3" b3own; own "$work/B4" b4own; own "$work/B4" b2own; own "$work/B5" b5own
backdate() { # renames the newest list to <days> days ago
  local newest; newest="$(keys | grep -E 'superseded-[0-9]{8}T[0-9]{6}Z' | sort | tail -1)"
  [ -n "$newest" ] || return 0
  local when; when="$(date -u -v-"$1"d +%Y%m%dT%H%M%SZ 2>/dev/null || date -u -d "$1 days ago" +%Y%m%dT%H%M%SZ)"
  s3 s3 mv "s3://$bucket/$newest" "s3://$bucket/deploy-manifests/superseded-$when.txt" --only-show-errors
}
d=0
for step in "B1 41" "B2 31" "B3 21" "B4 11" "B5 1"; do
  set -- $step; d=$((d + 1))
  deploy "$work/$1" none > "$work/retention-$1.log"
  [ "$1" = B5 ] || backdate "$2"   # D5's own list is "now", day 31
  echo "   D$d ($1): objects $(count); $(grep '^step 6:' "$work/retention-$1.log" | tail -1)"
done
has() { keys | grep -q "$1"; }
check "B1's own chunk gone (superseded 31 days before)" '! has "js/b1own\."'
check "B3's own chunk kept (11 days)" 'has "js/b3own\."'
check "B4's own chunk kept (1 day)" 'has "js/b4own\."'
check "the B2 chunk that B4 brought back kept (listed again by D5)" 'has "js/b2own\."'
check "B5's chunk present" 'has "js/b5own\."'
check "the pre-scheme orphans gone once their list aged out" '! keys | grep -qxF "$(cd "$work/base" && ls js/app.*.js | head -1)"'
check "lists older than 14 days deleted: D4 and D5 remain" '[ "$(keys | grep -c superseded-)" -eq 2 ]'

echo; [ "$failures" = 0 ] && echo "rehearsal: all checks passed" || { echo "rehearsal: $failures checks failed"; exit 1; }
