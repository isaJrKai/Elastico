#!/bin/bash
# Phase 13 audit: Check secondary screens for DS violations

BASE="/home/z/my-project/src/components/elastico"

echo "=== PHASE 13: SECONDARY SCREEN DS AUDIT ==="
echo ""

# 1. Check for raw <img> inside Dialog/Sheet/Drawer/Popover/AlertDialog/Select content
echo "--- 1. Raw <img> in overlay components ---"
for f in "$BASE"/*-view.tsx "$BASE"/header.tsx "$BASE"/command-palette.tsx; do
  # Find lines that have both an overlay indicator and <img
  # We'll check each file for <img tags
  count=$(rg -c '<img ' "$f" 2>/dev/null || echo 0)
  if [ "$count" != "0" ]; then
    echo "  VIOLATION: $f has $count raw <img> tags"
    rg -n '<img ' "$f"
  fi
done
echo "  Done."
echo ""

# 2. Check for inline chart styles (hard-coded colors, no chart-theme import)
echo "--- 2. Inline chart styles in secondary screens ---"
for f in "$BASE"/*-view.tsx; do
  has_chart=$(rg -c 'from .recharts' "$f" 2>/dev/null || echo 0)
  has_theme=$(rg -c 'chart-theme' "$f" 2>/dev/null || echo 0)
  if [ "$has_chart" != "0" ] && [ "$has_theme" = "0" ]; then
    echo "  VIOLATION: $f uses Recharts but no chart-theme import"
  fi
done
echo "  Done."
echo ""

# 3. Check for numeric values without data-class badges in Dialog/overlay content
echo "--- 3. Numeric values in overlay components (need data-class badges) ---"
# In admin-view, the user detail dialog has numbers (predictions, accuracy, streak, loginCount)
# Check if those have StatusBadge
echo "  Checking admin-view user detail dialog..."
rg -n 'text-lg font-bold' /home/z/my-project/src/components/elastico/admin-view.tsx | head -10
echo "  Done."
echo ""

# 4. Check for hardcoded CHART_COLORS in any file
echo "--- 4. Hardcoded CHART_COLORS local constants ---"
for f in "$BASE"/*-view.tsx; do
  count=$(rg -c "const CHART_COLORS" "$f" 2>/dev/null || echo 0)
  if [ "$count" != "0" ]; then
    echo "  VIOLATION: $f has local CHART_COLORS constant"
  fi
done
echo "  Done."
echo ""

# 5. Check for any `icon: any` typed props (should be React.ElementType)
echo "--- 5. `icon: any` prop types ---"
for f in "$BASE"/*-view.tsx; do
  count=$(rg -c 'icon: any' "$f" 2>/dev/null || echo 0)
  if [ "$count" != "0" ]; then
    echo "  VIOLATION: $f has 'icon: any' typed props"
    rg -n 'icon: any' "$f"
  fi
done
echo "  Done."
echo ""

# 6. Check for SectionHeader / StatusBadge / StatBlock usage opportunities in overlays
echo "--- 6. Views using custom section cards instead of SectionHeader ---"
for f in "$BASE"/*-view.tsx; do
  uses_section_header=$(rg -c 'SectionHeader' "$f" 2>/dev/null || echo 0)
  has_custom_section=$(rg -c 'text-xs text-muted-foreground uppercase tracking-wider' "$f" 2>/dev/null || echo 0)
  if [ "$has_custom_section" != "0" ] && [ "$uses_section_header" = "0" ]; then
    echo "  NOTE: $f has manual uppercase section labels but doesn't import SectionHeader"
  fi
done
echo "  Done."
echo ""

echo "=== AUDIT COMPLETE ==="
