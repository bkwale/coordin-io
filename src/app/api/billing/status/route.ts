import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { getPlan } from '@/lib/stripe'

/**
 * GET /api/billing/status — Current billing status + usage for the org.
 *
 * Returns plan info, subscription status, limits, and current usage counts.
 * Available to ADMIN and OWNER.
 */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const org = await prisma.organisation.findUniqueOrThrow({
    where: { id: profile.organisationId },
    select: {
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionId: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      stripeCustomerId: true,
    },
  })

  const plan = getPlan(org.subscriptionPlan)

  // Current usage counts
  const [projectCount, userCount] = await Promise.all([
    prisma.project.count({
      where: { organisationId: profile.organisationId },
    }),
    prisma.profile.count({
      where: {
        organisationId: profile.organisationId,
        status: 'ACTIVE',
      },
    }),
  ])

  return success({
    plan: {
      id: plan.id,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
    },
    subscription: {
      status: org.subscriptionStatus,
      currentPeriodEnd: org.currentPeriodEnd,
      trialEndsAt: org.trialEndsAt,
      hasStripeCustomer: !!org.stripeCustomerId,
      hasSubscription: !!org.subscriptionId,
    },
    usage: {
      projects: { current: projectCount, limit: plan.limits.maxProjects },
      users: { current: userCount, limit: plan.limits.maxUsers },
    },
    features: plan.limits.features,
  })
}, {
  requiredCapability: { feature: 'settings', action: 'view_org_settings' },
})
