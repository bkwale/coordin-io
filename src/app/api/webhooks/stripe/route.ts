import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

/**
 * POST /api/webhooks/stripe — Stripe webhook receiver.
 *
 * Handles subscription lifecycle events. No auth middleware —
 * verified via Stripe signature instead.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('[STRIPE_WEBHOOK] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    await handleStripeEvent(event)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error(`[STRIPE_WEBHOOK] Error handling ${event.type}:`, err)
    // Return 200 to prevent Stripe retries on application errors
    return NextResponse.json({ received: true, error: 'Handler failed' })
  }
}

// ── Event handler ────────────────────────────────────────────

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription)
      break

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
      break

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object as Stripe.Invoice)
      break

    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice)
      break

    default:
      console.log(`[STRIPE_WEBHOOK] Unhandled event type: ${event.type}`)
  }
}

// ── Handlers ─────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const organisationId = session.metadata?.organisationId
  const plan = session.metadata?.plan

  if (!organisationId || !plan) {
    console.warn('[STRIPE_WEBHOOK] checkout.session.completed missing metadata')
    return
  }

  await prisma.organisation.update({
    where: { id: organisationId },
    data: {
      subscriptionPlan: plan,
      subscriptionStatus: 'active',
      subscriptionId: typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null,
    },
  })

  console.log(`[STRIPE_WEBHOOK] Org ${organisationId} upgraded to ${plan}`)
}

async function handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const org = await prisma.organisation.findFirst({
    where: { stripeCustomerId: typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id ?? '' },
  })

  if (!org) {
    console.warn(`[STRIPE_WEBHOOK] No org for customer ${subscription.customer}`)
    return
  }

  // Derive plan from the first line item's price metadata or lookup table
  const firstItem = subscription.items.data[0]
  const priceId = firstItem?.price?.id
  const plan = resolvePlanFromPriceId(priceId)

  // In Stripe v23+, current_period_end is on items, not top-level Subscription
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : null

  await prisma.organisation.update({
    where: { id: org.id },
    data: {
      subscriptionId: subscription.id,
      subscriptionPlan: plan,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: periodEnd,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
  })

  console.log(`[STRIPE_WEBHOOK] Org ${org.id} subscription updated: ${plan} (${subscription.status})`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const org = await prisma.organisation.findFirst({
    where: { stripeCustomerId: typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id ?? '' },
  })

  if (!org) return

  await prisma.organisation.update({
    where: { id: org.id },
    data: {
      subscriptionPlan: 'free',
      subscriptionStatus: 'canceled',
      subscriptionId: null,
      currentPeriodEnd: null,
    },
  })

  console.log(`[STRIPE_WEBHOOK] Org ${org.id} subscription canceled — reverted to free`)
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id

  if (!customerId) return

  const org = await prisma.organisation.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!org) return

  // Ensure status is active after successful payment
  if (org.subscriptionStatus === 'past_due') {
    await prisma.organisation.update({
      where: { id: org.id },
      data: { subscriptionStatus: 'active' },
    })
  }

  console.log(`[STRIPE_WEBHOOK] Invoice paid for org ${org.id}`)
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id

  if (!customerId) return

  const org = await prisma.organisation.findFirst({
    where: { stripeCustomerId: customerId },
  })

  if (!org) return

  await prisma.organisation.update({
    where: { id: org.id },
    data: { subscriptionStatus: 'past_due' },
  })

  console.log(`[STRIPE_WEBHOOK] Payment failed for org ${org.id} — marked past_due`)
}

// ── Helpers ──────────────────────────────────────────────────

function resolvePlanFromPriceId(priceId: string | undefined): string {
  if (!priceId) return 'free'
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro'
  if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) return 'enterprise'
  // Fallback — check metadata or default
  return 'pro'
}
