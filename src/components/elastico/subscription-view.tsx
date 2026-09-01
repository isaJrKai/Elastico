'use client'

import React, { useState } from 'react'
import { useElasticoStore } from '@/store/use-elastico-store'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  Check, X, Crown, Zap, Star, Shield, BarChart3,
  MessageSquare, Lock, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionHeader, DataState } from '@/components/elastico/primitives'

// ── Types & Constants ────────────────────────────────────────────────────

interface PlanFeature { name: string; free: boolean | string; pro: boolean | string; elite: boolean | string }

interface PricingPlan {
  id: string; name: string; monthlyPrice: number; yearlyPrice: number
  description: string; icon: React.ElementType; features: string[]
  cta: string; borderClass: string
}

const PLANS: PricingPlan[] = [
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

const COMPARISON_FEATURES: PlanFeature[] = [
  { name: 'Base ELO Ratings', free: true, pro: true, elite: true },
  { name: 'Team Rankings', free: true, pro: true, elite: true },
  { name: 'Simulations / Day', free: '1', pro: 'Unlimited', elite: 'Unlimited' },
  { name: 'AI Chat Messages', free: '5/day', pro: 'Unlimited', elite: 'Unlimited' },
  { name: 'Community Leaderboard', free: true, pro: true, elite: true },
  { name: 'Basic Match Predictions', free: true, pro: true, elite: true },
  { name: 'Stochastic Simulation Engine', free: false, pro: true, elite: true },
  { name: 'Advanced ELO Metrics', free: false, pro: true, elite: true },
  { name: 'Probability Deep-Dives', free: false, pro: true, elite: true },
  { name: 'PDF Report Export', free: false, pro: true, elite: true },
  { name: 'Priority AI Access', free: false, pro: true, elite: true },
  { name: 'Monte Carlo Simulations', free: false, pro: false, elite: true },
  { name: 'Wilson Confidence Intervals', free: false, pro: false, elite: true },
  { name: 'Live Temporal Simulations', free: false, pro: false, elite: true },
  { name: 'Custom ELO Calibrations', free: false, pro: false, elite: true },
  { name: 'Full AI Bandwidth', free: false, pro: false, elite: true },
  { name: 'Tactical Analysis Engine', free: false, pro: false, elite: true },
  { name: 'API Access & Webhooks', free: false, pro: false, elite: true },
]

const FAQ_ITEMS = [
  { question: 'Can I switch plans at any time?', answer: 'Yes! You can upgrade or downgrade your plan at any time. When upgrading, you get immediate access. When downgrading, benefits continue until the end of your billing period.' },
  { question: 'What payment methods do you accept?', answer: 'Payment integration is not yet live. When launched, we plan to support major cards and digital wallets via a secure payment provider.' },
  { question: 'Is there a free trial for Pro or Elite?', answer: 'Free trials are not yet available. When payment integration is complete, trial options will be announced here.' },
  { question: 'What happens to my data if I downgrade?', answer: 'Your data is never deleted. Saved simulations and reports become read-only but are preserved.' },
  { question: 'Can I cancel anytime?', answer: 'Absolutely. Cancel anytime with no penalties. You keep access until your current billing period ends.' },
]

const TESTIMONIALS: { name: string; role: string; plan: string; avatar: string; quote: string; rating: number }[] = []
// Real testimonials will be collected from early users once the platform launches.
// Empty until then — no fabricated social proof.

// ── Helpers ──────────────────────────────────────────────────────────────

function FeatureCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-emerald-400" />
  if (value === false) return <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
  return <span className="text-sm text-foreground/80">{value}</span>
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function SubscriptionView() {
  const user = useElasticoStore(s => s.user)
  const currentPlan = user?.plan?.toLowerCase() || 'free'
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  const getCTA = (planId: string) => {
    if (planId === currentPlan) return 'Current Plan'
    const planIdx = PLANS.findIndex(p => p.id === planId)
    const currentIdx = PLANS.findIndex(p => p.id === currentPlan)
    return planIdx > currentIdx ? 'Upgrade' : 'Downgrade'
  }

  const handleSubscribe = (planId: string) => {
    if (planId === currentPlan) return
    toast.info('Coming soon', { description: `Subscription management via Stripe is planned. The ${PLANS.find(p => p.id === planId)?.name} plan will be available once payment integration is complete.` })
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-sm text-muted-foreground">Choose the plan that matches your analysis depth. Upgrade anytime.</p>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
          <Shield className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-400">Current: <span className="text-emerald-300 capitalize">{currentPlan}</span></span>
        </div>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-4">
        <span className={cn('text-sm font-medium transition-colors', billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground')}>Monthly</span>
        <button onClick={() => setBillingCycle(b => b === 'monthly' ? 'annual' : 'monthly')} className={cn('relative h-6 w-11 rounded-full transition-colors', billingCycle === 'annual' ? 'bg-emerald-500' : 'bg-muted')}>
          <span className={cn('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', billingCycle === 'annual' ? 'translate-x-5' : 'translate-x-0')} />
        </button>
        <span className={cn('text-sm font-medium transition-colors', billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground')}>Annual</span>
        {billingCycle === 'annual' && <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-0">Save 20%</Badge>}
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map(plan => {
          const isCurrent = plan.id === currentPlan
          const Icon = plan.icon
          const displayPrice = billingCycle === 'annual' ? plan.yearlyPrice : plan.monthlyPrice

          return (
            <Card key={plan.id} className={cn('rounded-lg border border-border bg-card relative flex flex-col overflow-hidden', plan.borderClass)}>
              <CardHeader className="pb-4 pt-6">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', plan.id === 'elite' ? 'bg-yellow-500/15 text-yellow-400' : plan.id === 'pro' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted/50 text-muted-foreground')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div><CardTitle className="text-lg">{plan.name}</CardTitle><CardDescription className="text-xs">{plan.description}</CardDescription></div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 space-y-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">{displayPrice === 0 ? 'Free' : `$${(displayPrice ?? 0).toFixed(2)}`}</span>
                  {displayPrice > 0 && <span className="text-sm text-muted-foreground">{billingCycle === 'annual' ? '/mo (billed annually)' : '/month'}</span>}
                </div>
                {displayPrice > 0 && billingCycle === 'annual' && (
                  <p className="text-[10px] text-muted-foreground line-through">${(plan.monthlyPrice ?? 0).toFixed(2)}/mo monthly</p>
                )}
                <Separator className="bg-border/50" />
                <ul className="space-y-3">
                  {plan.features.map(feature => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className={cn('mt-0.5 h-4 w-4 flex-shrink-0', isCurrent ? 'text-emerald-400' : 'text-muted-foreground/60')} />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-2 pb-6">
                <Button className={cn('w-full font-semibold', isCurrent ? 'bg-muted/50 text-muted-foreground cursor-default' : plan.id === 'pro' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : plan.id === 'elite' ? 'bg-yellow-600 hover:bg-yellow-700 text-yellow-950' : '')} variant={isCurrent ? 'outline' : 'default'} disabled={isCurrent} onClick={() => handleSubscribe(plan.id)}>
                  {isCurrent && <Lock className="mr-2 h-4 w-4" />}{getCTA(plan.id)}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* Testimonials — real reviews collected after launch */}
      {TESTIMONIALS.length > 0 && (
      <div className="space-y-4">
        <div className="flex items-center gap-2"><Users className="size-4 text-primary" /><SectionHeader label="What Users Say" /></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <Card key={i} className="rounded-lg border border-border bg-card">
              <CardContent className="p-5 space-y-3">
                <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, j) => <Star key={j} className={cn('size-3.5', j < t.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />)}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{t.quote}"</p>
                <Separator className="bg-border/30" />
                <div className="flex items-center gap-2">
                  <Avatar className="size-8"><AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">{t.avatar}</AvatarFallback></Avatar>
                  <div><p className="text-xs font-semibold">{t.name}</p><p className="text-[10px] text-muted-foreground">{t.role} · <span className="text-primary capitalize">{t.plan}</span></p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      )}

      {/* Feature Comparison Table */}
      <div className="space-y-4">
        <div className="flex items-center gap-2"><BarChart3 className="size-4 text-emerald-400" /><SectionHeader label="Feature Comparison" /></div>
        <Card className="rounded-lg border border-border bg-card overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="w-1/3 text-left text-sm font-semibold">Feature</TableHead>
                {PLANS.map(plan => <TableHead key={plan.id} className={cn('text-center text-sm font-semibold', plan.id === currentPlan && 'text-primary')}>{plan.name}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {COMPARISON_FEATURES.map(feature => (
                  <TableRow key={feature.name} className="border-border/30">
                    <TableCell className="py-3 text-sm font-medium">{feature.name}</TableCell>
                    <TableCell className="py-3 text-center"><FeatureCell value={feature.free} /></TableCell>
                    <TableCell className={cn('py-3 text-center', currentPlan === 'pro' && 'bg-emerald-500/[0.04]')}><FeatureCell value={feature.pro} /></TableCell>
                    <TableCell className={cn('py-3 text-center', currentPlan === 'elite' && 'bg-yellow-500/[0.04]')}><FeatureCell value={feature.elite} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* FAQ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2"><MessageSquare className="size-4 text-emerald-400" /><SectionHeader label="Frequently Asked Questions" /></div>
        <Card className="rounded-lg border border-border bg-card overflow-hidden rounded-xl">
          <CardContent className="p-0">
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border-border/50 px-6">
                  <AccordionTrigger className="py-4 text-sm font-medium hover:no-underline">{item.question}</AccordionTrigger>
                  <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}