import re

with open('/home/z/my-project/src/components/elastico/subscription-view.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = 'const PLANS: PricingPlan[] = ['
end_marker = '\nconst COMPARISON_FEATURES'

start = content.find(start_marker)
end = content.find(end_marker)

if start == -1 or end == -1:
    print('ERROR: markers not found!')
    import sys; sys.exit(1)

old_block = content[start:end]
print(f'Replacing {len(old_block)} bytes ({old_block.count(chr(10))} lines)')

new_block = '''const PLANS: PricingPlan[] = [
  {
    id: 'free', name: 'Free', monthlyPrice: 0, yearlyPrice: 0,
    description: 'Live scores, standings, and basic predictions', icon: Star,
    features: ['Base ELO ratings & team rankings', '1 simulation per day', 'Limited AI chat (5 messages/day)', 'Basic match predictions', 'Community leaderboard'],
    cta: 'Current Plan', borderClass: 'border-border/50',
  },
  {
    id: 'pro', name: 'Pro', monthlyPrice: 4.99, yearlyPrice: 3.99,
    description: 'Stochastic models, PDF export, unlimited chat', icon: Zap,
    features: ['Unlimited simulations', 'Advanced stochastic models', 'Priority AI chat access', 'PDF report export', 'Advanced ELO metrics', 'Match probability deep-dives'],
    cta: 'Subscribe', borderClass: 'border-emerald-500/40',
  },
  {
    id: 'elite', name: 'Elite', monthlyPrice: 8.99, yearlyPrice: 7.19,
    description: 'Monte Carlo sims, API access, full bandwidth', icon: Crown,
    features: ['Everything in Pro', 'Monte Carlo simulations', 'Wilson confidence intervals', 'Live temporal simulations', 'Custom ELO calibrations', 'Full AI bandwidth', 'Tactical analysis engine', 'API access & webhooks'],
    cta: 'Subscribe', borderClass: 'border-border/50',
  },
]

const COMPARISON_FEATURES'''

new_content = content[:start] + new_block + content[end:]

with open('/home/z/my-project/src/components/elastico/subscription-view.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

# Verify
with open('/home/z/my-project/src/components/elastico/subscription-view.tsx', 'r', encoding='utf-8') as f:
    verify = f.read()
if 'highlightClass' in verify:
    print('WARNING: highlightClass still present')
if "'],]" in verify:
    print('WARNING: ],] still present')
else:
    print('Clean rewrite complete!')
