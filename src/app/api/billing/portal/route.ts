import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError, PermissionError, ExternalServiceError } from '@/lib/errors'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/billing/portal — Create a Stripe Customer Portal session.
 *
 * Lets the owner manage payment method, view invoices, cancel subscription.
 * Returns: { url: string }
 *
 * OWNER only.
 */
export const POST = withAuth(async (_request: NextRequest, { profile }) => {
  if (profile.orgPermission !== 'OWNER') {
    throw new PermissionError('Only the organisation owner can access the billing portal')
  }

  const org = await prisma.organisation.findUniqueOrThrow({
    where: { id: profile.organisationId },
    select: { stripeCustomerId: true },
  })

  if (!org.stripeCustomerId) {
    throw new ValidationError(
      'No billing account found. Please subscribe to a plan first.',
    )
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=billing`,
    })

    return success({ url: session.url })
  } catch (err) {
    throw new ExternalServiceError(
      `Stripe portal failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    )
  }
})
