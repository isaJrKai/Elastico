#!/usr/bin/env python3
"""Add IP-based rate limiting to EXTERNAL-COST API routes."""

import re
import os

PROJECT = "/home/z/my-project/src/app/api"

# IP-based RL routes (public, external-cost)
IP_RL_ROUTES = {
    "api-sports/route.ts": (30, 60000, "api-sports"),
    "football-data/route.ts": (15, 60000, "football-data"),
    "live/route.ts": (30, 60000, "live"),
    "news/route.ts": (15, 60000, "news"),
    "odds/route.ts": (10, 60000, "odds"),
    "matches/route.ts": (30, 60000, "matches-list"),
    "matches/[id]/route.ts": (30, 60000, "match-detail"),
    "players/route.ts": (30, 60000, "players"),
    "players/[id]/route.ts": (20, 60000, "player-detail"),
    "teams/route.ts": (30, 60000, "teams"),
    "teams/[id]/route.ts": (20, 60000, "team-detail"),
    "standings/route.ts": (30, 60000, "standings"),
    "the-sports-db/route.ts": (20, 60000, "the-sports-db"),
    "the-odds/route.ts": (10, 60000, "the-odds"),
    "understat/route.ts": (15, 60000, "understat"),
    "statsbomb/route.ts": (20, 60000, "statsbomb"),
    "analytics/route.ts": (15, 60000, "analytics"),
    "prediction-engine/simulate/route.ts": (5, 60000, "simulate"),
    "system/veronica-heal/route.ts": (3, 60000, "veronica-heal"),
}

# User-based RL routes (already authenticated)
USER_RL_ROUTES = {
    "matches/[id]/simulate/route.ts": (10, 60000, "match-simulate"),
    "prediction-engine/kelly/route.ts": (20, 60000, "kelly"),
}


def has_rate_limit(content):
    return 'rateLimit(' in content


def add_rl_import(content):
    if 'from' in content and "'@/lib/rate-limit'" in content:
        return content
    if 'from' in content and '"@/lib/rate-limit"' in content:
        return content
    # Add after last import line
    lines = content.split('\n')
    last_import_idx = 0
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import_idx = i
    lines.insert(last_import_idx + 1, "import { rateLimit } from '@/lib/rate-limit'")
    return '\n'.join(lines)


def get_request_var(content, func_start):
    """Extract the request parameter name from function signature."""
    m = re.search(r'function\s+\w+\((\w+)', content[func_start:func_start+100])
    return m.group(1) if m else 'request'


def process_ip_route(filepath, limit, window, prefix):
    full_path = os.path.join(PROJECT, filepath)
    with open(full_path) as f:
        content = f.read()
    if has_rate_limit(content):
        print(f"  SKIP {filepath} (already has RL)")
        return

    content = add_rl_import(content)
    
    # Build the RL injection code
    rl_code = '''    // Rate limiting
    const ip = REQVAR.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = rateLimit(`PREFIX:${ip}`, LIMIT, WINDOW)
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }, { status: 429 })
'''
    rl_code = rl_code.replace('REQVAR', 'XXREQXX').replace('PREFIX', prefix).replace('LIMIT', str(limit)).replace('WINDOW', str(window))

    # Find each exported handler
    for handler in ['GET', 'POST']:
        pattern = rf'(export async function {handler}\((\w+)\)\s*\{{)'
        match = re.search(pattern, content)
        if not match:
            continue
        req_var = match.group(2)
        rl_actual = rl_code.replace('XXREQXX', req_var)
        insert_pos = match.end()
        # Check if next line is 'try {'
        rest = content[insert_pos:insert_pos+20].strip()
        if rest.startswith('try'):
            # Find the opening brace of try
            try_pos = content.index('{', insert_pos)
            content = content[:try_pos+1] + '\n' + rl_actual + content[try_pos+1:]
        else:
            content = content[:insert_pos] + '\n  try {' + '\n' + rl_actual + content[insert_pos:]
    
    with open(full_path, 'w') as f:
        f.write(content)
    print(f"  OK {filepath} ({limit}/min IP RL)")


def process_user_route(filepath, limit, window, prefix):
    full_path = os.path.join(PROJECT, filepath)
    with open(full_path) as f:
        content = f.read()
    if has_rate_limit(content):
        print(f"  SKIP {filepath} (already has RL)")
        return

    content = add_rl_import(content)
    
    # Find auth guard pattern and inject after it
    # Multiple possible patterns
    patterns = [
        r'(if\s*\(auth\s+instanceof\s+Response\)\s+return\s+auth\))',
        r'(if\s*\(auth instanceof Response\) return auth;\s*if\s*\(auth\.user\?\.role)',
    ]
    
    for pat in patterns:
        match = re.search(pat, content)
        if match:
            rl_code = f'''\n    const rl = rateLimit(`{prefix}:${{auth.user.id}}`, {limit}, {window})
    if (!rl.allowed) return NextResponse.json({{ error: 'Rate limited', retryAfterMs: rl.retryAfterMs }}, {{ status: 429 }})
'''
            insert_pos = match.end()
            content = content[:insert_pos] + rl_code + content[insert_pos:]
            break
    else:
        print(f"  WARN {filepath} (no auth guard found)")
        return
    
    with open(full_path, 'w') as f:
        f.write(content)
    print(f"  OK {filepath} ({limit}/min User RL)")


def main():
    print("=== Adding rate limiting ===")
    print("\n--- IP-based (public external-cost) ---")
    for route, (limit, window, prefix) in IP_RL_ROUTES.items():
        full = os.path.join(PROJECT, route)
        if os.path.exists(full):
            process_ip_route(route, limit, window, prefix)
        else:
            print(f"  MISSING {route}")
    
    print("\n--- User-based (authenticated) ---")
    for route, (limit, window, prefix) in USER_RL_ROUTES.items():
        full = os.path.join(PROJECT, route)
        if os.path.exists(full):
            process_user_route(route, limit, window, prefix)
        else:
            print(f"  MISSING {route}")


if __name__ == '__main__':
    main()