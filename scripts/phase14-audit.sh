#!/bin/bash
BASE="/home/z/my-project/src/components/elastico"

echo "=== PHASE 14: DATA-TRUTH AUDIT ==="
echo ""

# 1. Silent catch blocks that swallow errors
"echo "--- 1. Silent catch blocks ---"
rg -n 'catch.*\{\s*\}' "$BASE"/*-view.tsx 2>/dev/null
echo ""

# 2. catch with empty body or just comment
"echo "--- 2. Catch blocks with no error reporting ---"
rg -n -A2 'catch' "$BASE"/*-view.tsx 2>/dev/null | rg -B1 -A1 'catch \(\)' | head -40
echo ""

# 3. Fallback defaults that hide missing data (e.g., || 0, || '', ?? '')
"echo "--- 3. Default fallbacks on API data (potential silent data loss) ---"
rg -n '\|\| 0' "$BASE"/*-view.tsx 2>/dev/null | head -30
echo ""

# 4. API routes that might fail silently
"echo "--- 4. fetch calls without error UI ---"
rg -n 'fetch(' "$BASE"/*-view.tsx 2>/dev/null | head -20
echo ""

# 5. Data stores with silent failures
"echo "--- 5. Store actions / API routes ---"
ls /home/z/my-project/src/app/api/*/route.ts 2>/dev/null
echo ""

echo "=== AUDIT COMPLETE ==="
