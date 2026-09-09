#!/bin/bash
# Prune Vercel deployments: keep the newest KEEP (default 2 — production +
# one rollback), delete the rest. Deployment storage on the free tier is
# 10GB; every deploy retains a full copy of the ~2.8GB site forever, so
# without pruning the quota exhausts in days (hit 100% on 2026-09-08).
# Usage: VERCEL_TOKEN=... ./scripts-prune-deployments.sh [keep]
set -euo pipefail
TOK="${VERCEL_TOKEN:?VERCEL_TOKEN required}"
TEAM="team_ESjn8Fy4BBbh1gZ86oI4wRo5"
PROJ="prj_6wi3VkkU22tfM5iQjw2YKsYGSKgT"
KEEP="${1:-2}"
IDS=$(curl -fsS -m 60 "https://api.vercel.com/v6/deployments?projectId=$PROJ&limit=100&teamId=$TEAM" \
  -H "Authorization: Bearer $TOK" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d); (j.deployments??[]).sort((a,b)=>b.created-a.created).forEach(x=>console.log(x.uid))})")
TOTAL=$(printf '%s\n' "$IDS" | grep -c . || true)
if [ "$TOTAL" -le "$KEEP" ]; then echo "deployments: $TOTAL (≤ keep=$KEEP) — nothing to prune"; exit 0; fi
DELETED=0
SKIP=0
for id in $IDS; do
  SKIP=$((SKIP+1))
  [ "$SKIP" -le "$KEEP" ] && continue
  if curl -fsS -m 60 -X DELETE "https://api.vercel.com/v13/deployments/$id?teamId=$TEAM" -H "Authorization: Bearer $TOK" >/dev/null 2>&1; then
    DELETED=$((DELETED+1))
  else
    echo "  ! failed to delete $id (may be the active production alias)"
  fi
done
echo "pruned $DELETED/$((TOTAL-KEEP)) old deployments (kept newest $KEEP of $TOTAL)"
