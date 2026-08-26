#!/usr/bin/env python3
"""Fix broken template literal backtick nesting in rate-limited routes."""
import re
import os

API = '/home/z/my-project/src/app/api'

def fix_file(filepath):
    with open(filepath) as f:
        content = f.read()
    
    original = content
    
    # Fix: `prefix:`${var}` → `prefix:${var}`
    content = re.sub(
        r'`([a-zA-Z-]+):`\\$\{',
        r'`\1:${',
        content
    )
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'  Fixed backticks: {os.path.relpath(filepath, API)}')
        return True
    return False

def fix_import(filepath):
    with open(filepath) as f:
        content = f.read()
    
    lines = content.split('\n')
    
    # Find RL import lines
    rl_lines = []
    for i, line in enumerate(lines):
        if 'import { rateLimit }' in line:
            rl_lines.append(i)
    
    if not rl_lines:
        return False
    
    changed = False
    for rl_idx in rl_lines:
        if rl_idx > 0:
            prev = lines[rl_idx - 1].rstrip()
            # If previous line is an import continuation (indented, no 'from' keyword)
            if prev and (prev.startswith('  ') or prev.startswith('\t')) and 'from' not in prev:
                rl_import = lines[rl_idx]
                del lines[rl_idx]
                # Find the last complete import line
                last_import = 0
                for i, l in enumerate(lines):
                    if l.strip().startswith('import ') and ';' in l:
                        last_import = i
                    elif l.strip().startswith('import ') and 'from' in l:
                        last_import = i
                lines.insert(last_import + 1, rl_import)
                changed = True
    
    if changed:
        with open(filepath, 'w') as f:
            f.write('\n'.join(lines))
        print(f'  Fixed import: {os.path.relpath(filepath, API)}')
    
    return changed

# Process all files that have rateLimit
for root, dirs, files in os.walk(API):
    for f in files:
        if f == 'route.ts':
            fp = os.path.join(root, f)
            fix_file(fp)
            fix_import(fp)
