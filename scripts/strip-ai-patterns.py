#!/usr/bin/env python3
"""Strip AI-generated design patterns from all Elastico view components."""

import re
import os

COMPONENTS_DIR = "/home/z/my-project/src/components/elastico"

# ── Class replacements ────────────────────────────────────────────────────
# glass-card variants → simple rounded border card
GLASS_REPLACEMENTS = {
    "glass-card-premium": "rounded-lg border border-border bg-card",
    "glass-card-hover": "rounded-lg border border-border bg-card",
    "glass-card": "rounded-lg border border-border bg-card",
    "glass-intel": "rounded-lg border border-border bg-card",
    "glass-surface": "rounded-lg border border-border bg-card",
}

# Classes to remove entirely (strip from className strings)
STRIP_CLASSES = [
    "neon-border",
    "intel-border",
    "gradient-text",
    "text-gradient-primary",
    "text-intel",
    "animate-shimmer",
    "animate-aurora",
    "animate-ambient",
    "animate-elastico-glow",
    "animate-fade-in-up",
    "animate-scale-in",
    "animate-slide-in",
    "animate-slide-in-left",
    "animate-float-up",
    "animate-goal-flash",
    "animate-pulse-live",
    "badge-glow",
    "ring-glow-emerald",
    "ring-glow-intel",
    "card-hover-lift",
    "bento-grid",
    "bento-cell",
    "bento-dashboard",
    "span-2",
    "span-3",
    "span-4",
    "row-2",
    "aurora-bg",
    "noise-overlay",
    "glow-line",
    "panel-highlight",
    "streak-fire",
    "pulse-live",
    "intelligence-breathe",
    "ambient-dot",
    "ambient-bar",
    "data-stream",
    "micro-hover",
    "shimmer",
]

# bento-grid specific: the container class becomes a regular grid
BENTO_GRID_REPLACEMENT = "grid gap-3"

# transition-all → nothing (we have base layer press feedback now)
# We'll handle this separately since it's more nuanced


def strip_class_from_string(class_str: str, classes_to_strip: list[str]) -> str:
    """Remove specific class names from a className string."""
    parts = class_str.split()
    filtered = []
    for part in parts:
        # Check if this part starts with any class to strip
        stripped = False
        for cls in classes_to_strip:
            if part == cls or part.startswith(cls + " ") or part.startswith(cls + "\""):
                stripped = True
                break
            # Handle things like `glass-card-hover` which contains `glass-card`
            if cls in part and cls == part:
                stripped = True
                break
        if not stripped:
            filtered.append(part)
    return " ".join(filtered)


def process_file(filepath: str) -> int:
    """Process a single file, return number of changes."""
    with open(filepath, "r") as f:
        content = f.read()
    
    original = content
    changes = 0
    
    # 1. Replace glass-card variants
    for old, new in GLASS_REPLACEMENTS.items():
        # Match as standalone class (word boundary)
        pattern = r'\b' + re.escape(old) + r'\b'
        new_content, count = re.subn(pattern, new, content)
        if count > 0:
            content = new_content
            changes += count
    
    # 2. Replace bento-grid with regular grid
    content, count = re.subn(r'\bbento-grid\b', BENTO_GRID_REPLACEMENT, content)
    changes += count
    
    # 3. Remove bento-cell and its modifiers
    content, count = re.subn(r'\bbento-cell\s*', '', content)
    changes += count
    content, count = re.subn(r'\b(?:span-2|span-3|span-4|row-2)\b\s*', '', content)
    changes += count
    
    # 4. Strip all other AI pattern classes from className strings
    for cls in STRIP_CLASSES:
        if cls in ["glass-card", "glass-card-hover", "glass-card-premium", "glass-intel", "glass-surface", "bento-grid", "bento-cell", "span-2", "span-3", "span-4", "row-2", "shimmer"]:
            continue  # Already handled above
        pattern = r'\b' + re.escape(cls) + r'\b\s*'
        new_content, count = re.subn(pattern, '', content)
        if count > 0:
            content = new_content
            changes += count
    
    # 5. Remove aurora-bg and noise-overlay as standalone class usage
    # (they might be in className strings)
    for cls in ["aurora-bg", "noise-overlay"]:
        pattern = r'\b' + re.escape(cls) + r'\b\s*'
        new_content, count = re.subn(pattern, '', content)
        if count > 0:
            content = new_content
            changes += count
    
    # 6. Fix transition-all → transition-colors (safe default)
    content, count = re.subn(r'\btransition-all\b', 'transition-colors', content)
    changes += count
    
    # 7. Remove `text-shadow` glow from confidence classes in JSX
    # This handles inline style text-shadow
    content = re.sub(r'\s*text-shadow:\s*[^;"]+;?', '', content)
    changes += 1 if content != original else 0  # rough count
    
    # 8. Remove box-shadow glow from prob-bar-fill
    content = re.sub(
        r'box-shadow:\s*0\s+0\s+\d+px\s+rgba\([^)]+\)\s*;?',
        '', content
    )
    
    # 9. Remove --glow-* and --depth-* CSS var references from inline styles
    content = re.sub(r'--glow-[a-z]+', '', content)
    content = re.sub(r'--depth-\d+', '', content)
    
    # 10. Clean up double spaces in classNames
    content = re.sub(r'className=\{cn\(\s*"([^"]+)"', lambda m: 'className={cn("' + re.sub(r'\s{2,}', ' ', m.group(1)).strip() + '"', content)
    content = re.sub(r'className="([^"]+)"', lambda m: 'className="' + re.sub(r'\s{2,}', ' ', m.group(1)).strip() + '"', content)
    
    if content != original:
        with open(filepath, "w") as f:
            f.write(content)
        return changes
    return 0


def main():
    total_changes = 0
    files_changed = 0
    
    for filename in sorted(os.listdir(COMPONENTS_DIR)):
        if not filename.endswith(".tsx"):
            continue
        filepath = os.path.join(COMPONENTS_DIR, filename)
        changes = process_file(filepath)
        if changes > 0:
            total_changes += changes
            files_changed += 1
            print(f"  {filename}: {changes} replacements")
    
    print(f"\nTotal: {files_changed} files, {total_changes} replacements")


if __name__ == "__main__":
    main()
