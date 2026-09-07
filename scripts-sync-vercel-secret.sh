#!/bin/bash
# DEPRECATED as an overwriter: the repo secret now holds a NEVER-EXPIRING
# dashboard token. The old behaviour (copying the CLI's expiring session token)
# silently clobbered it and broke nightly deploys. Kept as a no-op guard so old
# chain scripts that call it stay harmless.
echo "VERCEL_TOKEN: permanent dashboard token in place — nothing to sync (this script is now a no-op)."
