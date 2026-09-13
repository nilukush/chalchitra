#!/bin/bash
# Prune Vercel deployments: keep the newest KEEP (default 2 — production +
# one rollback) among deployments in a USABLE state (READY/BUILDING/QUEUED),
# delete everything else. ERRORED/CANCELED deployments never earn a keep slot:
# a transient deploy failure (CLI "Error: fetch failed" mid-extract) leaves an
# ERRORED deployment behind, and state-blind keeping let one displace the good
# rollback (observed 2026-09-13). Deployment storage on the free tier is 10GB;
# every deploy retains a full copy of the ~2.8GB site, so without pruning the
# quota exhausts in days (hit 100% on 2026-09-08).
# Usage: VERCEL_TOKEN=... ./scripts-prune-deployments.sh [keep] [projectId]
set -euo pipefail
TOK="${VERCEL_TOKEN:?VERCEL_TOKEN required}"
TEAM="team_ESjn8Fy4BBbh1gZ86oI4wRo5"
PROJ="${2:-prj_6wi3VkkU22tfM5iQjw2YKsYGSKgT}" # default: chalchitra
KEEP="${1:-2}"
PLAN=$(curl -fsS -m 60 "https://api.vercel.com/v6/deployments?projectId=$PROJ&limit=100&teamId=$TEAM" \
  -H "Authorization: Bearer $TOK" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{
      const j=JSON.parse(d), all=(j.deployments??[]).sort((a,b)=>b.created-a.created);
      const usable=s=>s==='READY'||s==='BUILDING'||s==='QUEUED'||s==='INITIALIZING';
      const keep=new Set(all.filter(x=>usable(x.readyState??x.state)).slice(0,${KEEP}).map(x=>x.uid));
      all.forEach(x=>console.log((keep.has(x.uid)?'keep ':'drop ')+x.uid+' '+(x.readyState??x.state??'?')));
    })")
echo "$PLAN"
TOTAL=$(printf '%s\n' "$PLAN" | grep -c . || true)
KEEPS=$(printf '%s\n' "$PLAN" | grep -c '^keep ' || true)
DROPS=$(printf '%s\n' "$PLAN" | grep -c '^drop ' || true)
DELETED=0
for id in $(printf '%s\n' "$PLAN" | awk '$1=="drop"{print $2}'); do
  if curl -fsS -m 60 -X DELETE "https://api.vercel.com/v13/deployments/$id?teamId=$TEAM" -H "Authorization: Bearer $TOK" >/dev/null 2>&1; then
    DELETED=$((DELETED+1))
  else
    echo "  ! failed to delete $id (may be the active production alias)"
  fi
done
echo "pruned $DELETED/$DROPS non-keep deployments (kept $KEEPS usable of $TOTAL; keep=$KEEP)"
