import Stripe from 'stripe'

// ── Stripe SDK singleton ─────────────────────────────────────
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia' as Stripe.LatestApiVersion,
  typescript: true,
})

// ── Plan definitions ─────────────────────────────────────────

export interface PlanLimits {
  maxProjects: number
  maxUsers: number
  /** Features included beyond Free */
  features: string[]
}

export interface PlanDefinition {
  id: string
  name: string
  /** Monthly price in pence (GBP) — 0 for Free */
  priceMonthly: number
  /** Stripe Price ID — null for Free (no checkout needed) */
  stripePriceId: string | null
  limits: PlanLimits
}

export const PLANS: Record<string, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    stripePriceId: null,
    limits: {
      maxProjects: 3,
      maxUsers: 2,
      features: [],
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 4900, // £49/mo
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? '',
    limits: {
      maxProjects: 50,
      maxUsers: 25,
      features: [
        'integrations',
        'advanced_reporting',
        'custom_branding',
        'priority_support',
      ],
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 14900, // £149/mo
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? '',
    limits: {
      maxProjects: Infinity,
      maxUsers: Infinity,
      features: [
        'integrations',
        'advanced_reporting',
        'custom_branding',
        'priority_support',
        'sso',
        'audit_log_export',
        'dedicated_support',
        'api_access',
      ],
    },
  },
}

/**
 * Resolve the plan definition for a subscription_plan string.
 * Falls back to 'free' for unknown values.
 */
export function getPlan(planId: string): PlanDefinition {
  return PLANS[planId] ?? PLANS.free
}

/**
 * Check whether an org has hit its plan limit for a given dimension.
 */
export function isWithinLimit(
  plan: PlanDefinition,
  dimension: 'maxProjects' | 'maxUsers',
  currentCount: number,
): boolean {
  return currentCount < plan.limits[dimension]
}
