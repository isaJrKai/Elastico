#!/bin/bash
BASE="/home/z/my-project/src/components/elastico"

echo "=== PHASE 13 VERIFICATION ==="
echo ""

# 1. Raw <img> check
echo "--- 1. Raw <img> in elastico views ---"
count=$(rg -c '<img ' $BASE/*-view.tsx $BASE/header.tsx $BASE/command-palette.tsx 2>/dev/null | grep -v ':0$' | wc -l)
if [ "$count" = "0" ]; then echo "  PASS: zero raw <img> tags"; else echo "  FAIL: $count files have raw <img>"; fi
echo ""

# 2. 'as any' type casts
echo "--- 2. 'as any' type casts ---"
count=$(rg -c 'as any' $BASE/*-view.tsx 2>/dev/null | grep -v ':0$' | wc -l)
if [ "$count" = "0" ]; then echo "  PASS: zero 'as any' casts"; else echo "  FAIL: $count files have 'as any'"; rg -n 'as any' $BASE/*-view.tsx 2>/dev/null | grep -v ':0$'; fi
echo ""

# 3. icon: any prop types
echo "--- 3. 'icon: any' prop types ---"
count=$(rg -c 'icon: any' $BASE/*-view.tsx 2>/dev/null | grep -v ':0$' | wc -l)
if [ "$count" = "0" ]; then echo "  PASS: zero 'icon: any' types"; else echo "  FAIL: $count files have 'icon: any'"; rg -n 'icon: any' $BASE/*-view.tsx 2>/dev/null | grep -v ':0$'; fi
echo ""

# 4. Dead Dialog imports
echo "--- 4. Dead Dialog imports ---"
for f in $BASE/*-view.tsx; do
  has_import=$(rg -c 'from .@/components/ui/dialog' "$f" 2>/dev/null || echo 0)
  if [ "$has_import" != "0" ]; then
    uses=$(rg -c '<Dialog' "$f" 2>/dev/null || echo 0)
    if [ "$uses" = "0" ]; then
      echo "  FAIL: $f imports Dialog but doesn't use it"
    fi
  fi
done
echo "  (if no FAIL lines above, PASS)"
echo ""

# 5. Local CHART_COLORS constants
echo "--- 5. Local CHART_COLORS constants ---"
count=$(rg -c 'const CHART_COLORS' $BASE/*-view.tsx 2>/dev/null | grep -v ':0$' | wc -l)
if [ "$count" = "0" ]; then echo "  PASS: zero local CHART_COLORS"; else echo "  FAIL: $count files have CHART_COLORS"; fi
echo ""

# 6. Admin data-class badges
echo "--- 6. Admin-view data-class badge coverage ---"
# Count numeric displays without StatusBadge nearby (approximate)
numbers=$(rg -c 'text-lg font-bold' $BASE/admin-view.tsx 2>/dev/null)
badges=$(rg -c 'StatusBadge' $BASE/admin-view.tsx 2>/dev/null)
echo "  Numeric displays: $numbers, StatusBadge usages: $badges"
echo ""

echo "=== VERIFICATION COMPLETE ==="
