import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError, PermissionError, ExternalServiceError } from '@/lib/errors'
import { stripe, PLANS } from '@/lib/stripe'

/**
 * POST /api/billing/checkout — Create a Stripe Checkout session for plan upgrade.
 *
 * Body: { plan: 'pro' | 'enterprise' }
 * Returns: { url: string } — the Stripe-hosted checkout page URL.
 *
 * OWNER only.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only the organisation owner can manage billing')
  }

  const body = await request.json()
  const plan = body?.plan as string

  if (!plan || !PLANS[plan] || plan === 'free') {
    throw new ValidationError('Invalid plan. Choose "pro" or "enterprise".')
  }

  const planDef = PLANS[plan]
  if (!planDef.stripePriceId) {
    throw new ValidationError('This plan does not require a checkout session')
  }

  const org = await prisma.organisation.findUniqueOrThrow({
    where: { id: profile.organisationId },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
      subscriptionPlan: true,
    },
  })

  // Don't allow re-subscribing to the same plan
  if (org.subscriptionPlan === plan) {
    throw new ValidationError(`You are already on the ${planDef.name} plan`)
  }

  // Create or reuse Stripe customer
  let customerId = org.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { organisationId: org.id },
    })
    customerId = customer.id

    await prisma.organisation.update({
      where: { id: org.id },
      data: { stripeCustomerId: customerId },
    })
  }

  // Create Checkout Session
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: planDef.stripePriceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing&checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing&checkout=cancelled`,
      metadata: {
        organisationId: org.id,
        plan,
      },
    })

    return success({ url: session.url })
  } catch (err) {
    throw new ExternalServiceError(
      `Stripe checkout failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    )
  }
})
