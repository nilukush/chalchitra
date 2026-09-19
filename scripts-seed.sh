#!/bin/bash
# Seed release helpers. GitHub caps a single release asset at 2 GB and
# data/cache grows ~20+ MB/day (expansion trickle), so the pipeline cache
# tarball is published as split `seed-part-NN.part` assets (≤1.4 GB each);
# `fetch` concatenates them and falls back to the legacy monolith asset for
# releases published before the split. Public repo — no auth needed to read.
# Usage:
#   scripts-seed.sh fetch  [out.tar.gz]   (default /tmp/seed.tgz)
#   scripts-seed.sh publish <tar.gz>      (split, upload, retire obsolete)
set -euo pipefail
REPO="nilukush/chalchitra"

fetch() {
  OUT="${1:-/tmp/seed.tgz}"
  PARTS=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/tags/seed" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);(j.assets??[]).filter(a=>/^seed-part-\d+\.part$/.test(a.name)).sort((a,b)=>a.name<b.name?-1:1).forEach(a=>console.log(a.browser_download_url))})")
  if [ -n "$PARTS" ]; then
    echo "seed: fetching $(printf '%s\n' $PARTS | wc -l | tr -d ' ') part(s)"
    : > "$OUT"
    for url in $PARTS; do curl -fsSL "$url" >> "$OUT"; done
  else
    echo "seed: no parts published — legacy monolith asset"
    curl -fsSL "https://github.com/$REPO/releases/download/seed/pipeline-cache.tar.gz" -o "$OUT"
  fi
  echo "seed: wrote $OUT ($(du -h "$OUT" | cut -f1))"
}

publish() {
  TARBALL="${1:?tarball required}"
  DIR=$(dirname "$TARBALL")
  rm -f "$DIR"/seed-part-*.part
  # no --additional-suffix (GNU-only): split bare, then rename (macOS-safe)
  split -b 1400m -d -a 2 "$TARBALL" "$DIR/seed-part-"
  for f in "$DIR"/seed-part-[0-9]*; do mv "$f" "$f.part"; done
  gh release create seed --title "Pipeline cache seed" --notes "Auto-refreshed pipeline cache (data/cache), split into parts; reassembled by scripts-seed.sh fetch." --latest >/dev/null 2>&1 || true
  for p in "$DIR"/seed-part-*.part; do gh release upload seed "$p" --clobber; done
  # retire assets that are no longer part of the current set (the legacy
  # monolith, or stale parts if the part count ever shrinks)
  gh api "repos/$REPO/releases/tags/seed" --jq '.assets[] | "\(.id) \(.name)"' \
    | while read -r id name; do
        case "$name" in
          seed-part-*.part) ;;
          *) gh api -X DELETE "repos/$REPO/releases/assets/$id" >/dev/null && echo "seed: retired $name" ;;
        esac
      done
  echo "seed: published $(ls "$DIR"/seed-part-*.part | wc -l | tr -d ' ') part(s)"
}

case "${1:-}" in
  fetch) shift; fetch "$@" ;;
  publish) shift; publish "$@" ;;
  *) echo "usage: scripts-seed.sh {fetch [out.tar.gz] | publish <tar.gz>}"; exit 2 ;;
esac
