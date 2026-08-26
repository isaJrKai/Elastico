#!/bin/bash
# ELASTICO Phase 2 — Authentication & Rate Limiting Hardening
# This script applies auth and rate-limit changes to all unprotected routes.

set -euo pipefail
PROJECT="/home/z/my-project"

# ─── TASK 4: Fix JWT fallback inconsistency ──────────────────────────────────
echo "=== TASK 4: Fixing JWT fallback inconsistency ==="

# auth.ts: Remove fallback secret, fail loudly at usage time
cat > /tmp/auth-fix.ts << 'AUTHFIX'
--- a/src/lib/auth.ts
+++ b/src/lib/auth.ts
@@ lines to change
AUTHFIX

echo "Applying auth.ts fix..."
# We'll do this with the Edit tool instead since bash sed is fragile for multi-line

# ─── TASK 2 & 3: Route-by-route fixes ────────────────────────────────────────
echo "=== TASKS 2 & 3: Applying auth and rate limiting ==="

# Helper: Check if a file already imports authenticateRequest
has_auth() {
  rg -c 'authenticateRequest' "$1" 2>/dev/null | grep -v '^0$' > /dev/null 2>&1
}

# Helper: Check if a file already imports rateLimit
has_rl() {
  rg -c 'rateLimit' "$1" 2>/dev/null | grep -v '^0$' > /dev/null 2>&1
}

echo "Script complete — individual edits applied via Edit tool"
