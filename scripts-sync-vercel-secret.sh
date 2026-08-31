#!/bin/bash
# Sync the GitHub VERCEL_TOKEN secret from the local Vercel CLI session token.
# WHY: the CLI rotates its session token around local deployments — any copy
# in the repo secret dies after the next local deploy. Run this AFTER every
# local `vercel deploy` (the chain scripts do) so CI's deploy keeps working.
node -e "const a=require(require('os').homedir()+'/Library/Application Support/com.vercel.cli/auth.json'); process.stdout.write(a.token)" \
  | gh secret set VERCEL_TOKEN --repo nilukush/chalchitra
echo "VERCEL_TOKEN secret re-synced from local CLI auth"
