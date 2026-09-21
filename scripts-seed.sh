#!/bin/bash
# Seed release helpers. GitHub caps a single release asset at 2 GB and
# data/cache grows ~20+ MB/day (expansion trickle), so the pipeline cache
# tarball is published as split `seed-part-NN.part` assets (≤1.4 GB each);
# `fetch` concatenates them and falls back to the legacy monolith asset for
# releases published before the split. Public repo — no auth needed to read.
#
# Usage:
#   scripts-seed.sh fetch  [out.tar.gz]              (default /tmp/seed.tgz)
#   scripts-seed.sh publish <tar.gz>                 (split, upload, keep one
#                                                     previous version as
#                                                     seed-prev-NN.part, retire obsolete)
#   scripts-seed.sh swap [--dry-run]                 (GUARDED publish + CI cache
#                                                     eviction — refuses while the
#                                                     local cache is behind production)
#   scripts-seed.sh rollback [--dry-run] --yes       (restore the previous seed,
#                                                     evict caches; data newer than the
#                                                     rollback point is re-fetched)
set -euo pipefail
REPO="nilukush/chalchitra"
SITE_URL="${SITE_URL:-https://chalchitra-pied.vercel.app}"
# healthy local pages ≈ live docs + this margin (persons/subpages/API pages
# are not search docs). Below it, the local cache is a REGRESSION, not a seed
# (Issue 5: a stale local seed 404'd ~62 production pages).
MIN_MARGIN="${MIN_MARGIN:-15000}"

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

assets() { gh api "repos/$REPO/releases/tags/seed" --jq '.assets[] | "\(.id) \(.name)"'; }

rename_asset() { # <asset-id> <new-name>
  gh api -X PATCH "repos/$REPO/releases/assets/$1" -f name="$2" >/dev/null
}

# preserve the CURRENT parts as the single previous version, then upload new
keep_previous() {
  local kept=0
  while read -r id name; do
    case "$name" in
      seed-part-*.part)
        # rename to the previous-version namespace: seed-part-00.part → seed-prev-00.part
        local n="${name#seed-part-}"; n="seed-prev-${n}"
        rename_asset "$id" "$n" && kept=$((kept+1)) || true
        ;;
    esac
  done < <(assets)
  # drop any OLDER prev parts beyond the one just written (same-numbered ones
  # were renamed above; different numbers = older set → retire)
  while read -r id name; do
    case "$name" in
      seed-prev-*.part) : ;; # kept (single previous version)
      *) gh api -X DELETE "repos/$REPO/releases/assets/$id" >/dev/null && echo "seed: retired $name" || true ;;
    esac
  done < <(assets)
  [ "$kept" -gt 0 ] 2>/dev/null && echo "seed: kept $kept previous-version part(s) as seed-prev-NN.part" || echo "seed: (no previous version to keep)"
}

publish() {
  TARBALL="${1:?tarball required}"
  DIR=$(dirname "$TARBALL")
  rm -f "$DIR"/seed-part-*.part
  # no --additional-suffix (GNU-only): split bare, then rename (macOS-safe)
  split -b 1400m -d -a 2 "$TARBALL" "$DIR/seed-part-"
  for f in "$DIR"/seed-part-[0-9]*; do mv "$f" "$f.part"; done
  gh release create seed --title "Pipeline cache seed" --notes "Auto-refreshed pipeline cache (data/cache), split into parts; reassembled by scripts-seed.sh fetch. One previous version is kept as seed-prev-NN.part for rollback." --latest >/dev/null 2>&1 || true
  keep_previous
  for p in "$DIR"/seed-part-*.part; do gh release upload seed "$p" --clobber; done
  # retire assets that are no longer part of the current or previous set;
  # prev parts numbered beyond the current part count are stale leftovers
  # from a larger old cache
  local count; count=$(ls "$DIR"/seed-part-*.part | wc -l | tr -d ' ')
  while read -r id name; do
    local keep=false
    case "$name" in
      seed-part-*.part) keep=true ;;
      seed-prev-*.part)
        local n="${name#seed-prev-}"; n="${n%.part}"
        [ "$n" -lt "$count" ] && keep=true
        ;;
    esac
    [ "$keep" = true ] || gh api -X DELETE "repos/$REPO/releases/assets/$id" >/dev/null && echo "seed: retired $name" || true
  done < <(assets)
  echo "seed: published $(ls "$DIR"/seed-part-*.part | wc -l | tr -d ' ') part(s)"
}

evict_ci_caches() {
  local ids evicted=0
  ids=$(gh api "repos/$REPO/actions/caches" --paginate --jq '.actions_caches[] | select(.key|startswith("pipeline-cache")) | .id')
  for id in $ids; do gh api -X DELETE "repos/$REPO/actions/caches/$id" >/dev/null && evicted=$((evicted+1)); done
  echo "seed-swap: evicted $evicted CI cache(s)"
}

guard() { # exits 1 when the local cache is NOT a production superset
  local local_pages prod_docs
  local_pages=$(ls data/cache/pages 2>/dev/null | wc -l | tr -d ' ')
  prod_docs=$(curl -fsSL --max-time 30 "$SITE_URL/search-index.json" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).docs.length))") \
    || { echo "seed-swap: cannot read $SITE_URL/search-index.json — refusing to swap blind (FORCE=1 to override)"; return 1; }
  echo "seed-swap: local pages=$local_pages | live docs=$prod_docs | count tripwire ≥ $((prod_docs + MIN_MARGIN))"
  if [ "$local_pages" -lt $((prod_docs + MIN_MARGIN)) ]; then
    echo "seed-swap: REFUSING (count tripwire) — local cache grossly behind production."
    [ "${FORCE:-0}" = "1" ] || return 1
    echo "  FORCE=1 set — continuing to the exact check."
  fi
  # EXACT guard: every doc id on the live site must exist in local data.
  # The count tripwire alone cannot catch Issue 5 (the corpora differed in
  # CONTENT by ~60 pages each way, not size).
  if ! npx tsx pipeline/postdeploy-check.ts --from-data --canaries 0; then
    echo "seed-swap: REFUSING (superset guard) — live pages missing from local data (Issue 5 class)."
    echo "  Catch up first (npm run pipeline:expand 0 && npm run pipeline:expand N && npm run pipeline:dataset),"
    echo "  or skip the swap and let the nightly trickle absorb local-only pages."
    return 1
  fi
}

swap() {
  local dry=0; [ "${1:-}" = "--dry-run" ] && dry=1
  if [ "$dry" = 1 ]; then
    guard || echo "seed-swap dry-run: guard would REFUSE this swap"
    echo "seed-swap dry-run: would tar data/cache, publish parts (keeping one previous version), evict CI caches"
    return 0
  fi
  guard
  tar -czf /tmp/pipeline-cache.tar.gz data/cache
  publish /tmp/pipeline-cache.tar.gz
  evict_ci_caches
  echo "seed-swap: done — CI bootstraps from the new seed on its next run"
}

rollback() {
  local dry=0 yes=0
  for a in "$@"; do
    case "$a" in
      --dry-run) dry=1 ;;
      --yes) yes=1 ;;
    esac
  done
  local cur prev
  cur=$(assets | awk '$2 ~ /^seed-part-[0-9]+\.part$/ {c++} END {print c+0}')
  prev=$(assets | awk '$2 ~ /^seed-prev-[0-9]+\.part$/ {c++} END {print c+0}')
  echo "seed-rollback: current parts=$cur previous parts=$prev"
  if [ "$cur" = 0 ] || [ "$prev" = 0 ]; then
    echo "seed-rollback: need BOTH current and previous part sets on the release — nothing to roll back to"
    return 1
  fi
  if [ "$dry" = 1 ]; then
    echo "seed-rollback dry-run: would delete current parts, rename seed-prev-NN.part → seed-part-NN.part, evict CI caches; you then dispatch refresh-daily"
    return 0
  fi
  if [ "$yes" != 1 ]; then echo "seed-rollback: destructive — rerun with --yes"; return 1; fi
  while read -r id name; do
    case "$name" in
      seed-part-*.part) gh api -X DELETE "repos/$REPO/releases/assets/$id" >/dev/null ;;
    esac
  done < <(assets)
  while read -r id name; do
    case "$name" in
      seed-prev-*.part) rename_asset "$id" "${name/prev-/part-}" ;;  # seed-prev-00.part → seed-part-00.part
    esac
  done < <(assets)
  evict_ci_caches
  echo "seed-rollback: previous seed restored — dispatch refresh-daily to rebuild + redeploy from it"
  echo "  (pages fetched after the rolled-back point are simply re-fetched by the next runs)"
}

case "${1:-}" in
  fetch) shift; fetch "$@" ;;
  publish) shift; publish "$@" ;;
  swap) shift; swap "$@" ;;
  rollback) shift; rollback "$@" ;;
  *) echo "usage: scripts-seed.sh {fetch [out.tar.gz] | publish <tar.gz> | swap [--dry-run] | rollback [--dry-run] --yes}"; exit 2 ;;
esac
