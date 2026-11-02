#!/usr/bin/env bash
# Replace every .js and .css under the build directory with its gzip encoding, in place, for an upload that declares
# `Content-Encoding: gzip` (.github/workflows/deploy.yml).
#
# Why: the buckets are plain object storage behind the edge, and neither negotiates encodings. The `.gz` and `.br`
# siblings vue-cli-plugin-compression writes were uploaded and never served, so every first load downloaded 7.9 MB of
# JavaScript as is (measured on dashboard.mrcall.ai, v2.2.46, 2026-11-02): first paint after 9.3 s on a 9 Mbps line
# and 46.7 s on 1.6 Mbps, the page blank all that time. Gzipped, app.js alone goes from 4.2 MB to 1.1 MB. Gzip and
# not brotli: with no negotiation the one encoding stored must be one every browser accepts.
#
# The siblings are removed: nothing requests them, and an object named app.js.gz holding gzip next to an app.js that
# now holds gzip too would only mislead.
set -euo pipefail

dir="${1:?usage: precompress.sh <build directory>}"

find "$dir" -type f \( -name '*.gz' -o -name '*.br' \) -delete

count=0
while IFS= read -r -d '' file; do
  # -n: no name or timestamp in the header, so the same bundle gzips to the same bytes on every build
  gzip -9 -n -c "$file" > "$file.tmp"
  mv "$file.tmp" "$file"
  count=$((count + 1))
done < <(find "$dir" -type f \( -name '*.js' -o -name '*.css' \) -print0)

echo "precompress: $count files gzipped in $dir"
