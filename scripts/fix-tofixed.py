#!/usr/bin/env python3
"""Replace all risky .toFixed() calls in component files with safe sf() wrapper."""
import re, os, sys

COMPONENTS_DIR = '/home/z/my-project/src/components/elastico'

# Files to process (all .tsx files)
files_to_process = []
for f in os.listdir(COMPONENTS_DIR):
    if f.endswith('.tsx'):
        files_to_process.append(os.path.join(COMPONENTS_DIR, f))

# Pattern: something.toFixed(digits)  where 'something' could be complex expression
# We want to wrap the VALUE before .toFixed with sf(...)

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern 1: simple - expr.toFixed(N)
    # Replace with sf(expr, N)
    # Be careful not to double-wrap already-safe calls like (x ?? 0).toFixed(N)
    
    # Find all .toFixed( calls that are NOT already wrapped in sf(
    # Strategy: find each .toFixed(N) and trace back to find the expression
    
    # Simpler approach: replace (expr).toFixed(N) with sf(expr, N) for all occurrences
    # But we need to handle nested parens correctly
    
    # Let's use a regex that matches: <anything>.toFixed(<digits>)
    # and replaces with sf(<anything>, <digits>)
    
    # First, add import if not present
    if 'from \'@/lib/utils\'' in content or 'from "@/lib/utils"' in content:
        if 'sf' not in content.split('from')[0].split('import')[0]:
            # Already imports from utils, just add sf to the import
            content = re.sub(
                r"(import\s*\{[^}]*?)(\}\s*from\s*['\"]@/lib/utils['\"])",
                r"\1, sf\2",
                content
            )
    else:
        # Add new import line after 'use client' or at top
        if "'use client'" in content:
            content = content.replace("'use client'", "'use client'\nimport { sf } from '@/lib/utils'", 1)
        elif '"use client"' in content:
            content = content.replace('"use client"', '"use client"\nimport { sf } from \'@/lib/utils\'', 1)
        else:
            content = "import { sf } from '@/lib/utils'\n" + content
    
    # Now replace all .toFixed(N) patterns
    # Match: <expression>.toFixed(<number>)
    # We need to find the expression by matching balanced parens/brackets going backward
    
    # Simpler regex-based approach for common patterns:
    
    # Pattern: (expr).toFixed(N) -> sf(expr, N)  [already has parens around expr]
    # Pattern: expr.toFixed(N) -> sf(expr, N)    [simple identifier or property access]
    
    def replace_tofixed(match):
        expr = match.group(1)
        decimals = match.group(2)
        # Don't double-wrap
        if expr.startswith('sf('):
            return match.group(0)
        return f'sf({expr}, {decimals})'
    
    # Match (complex expression).toFixed(digits)
    content = re.sub(r'\(([^)]+)\)\.toFixed\((\d+)\)', replace_tofixed, content)
    
    # Match simple.property.toFixed(digits) or identifier.toFixed(digits)
    content = re.sub(r'([a-zA-Z_][a-zA-Z0-9_.]*)\.toFixed\((\d+)\)', replace_tofixed, content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        count = len(re.findall(r'\.toFixed\(', original)) - len(re.findall(r'(?<!sf\()\.toFixed\(', content))
        # Recount properly
        old_count = len(re.findall(r'\.toFixed\(', original))
        new_unwrapped = len([m for m in re.finditer(r'\.toFixed\(', content) if not content[:m.start()].rstrip().endswith('f(')])
        print(f'  {os.path.basename(filepath)}: processed')
        return True
    else:
        print(f'  {os.path.basename(filepath)}: no changes needed')
        return False

count = 0
for filepath in sorted(files_to_process):
    print(f'Processing {os.path.basename(filepath)}...')
    if fix_file(filepath):
        count += 1

print(f'\nDone! Modified {count} files.')
