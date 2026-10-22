import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'wale@techsanctum.org'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Coordin.io <noreply@coordin.io>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.coordin.io'

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * POST /api/support — Submit a support ticket.
 *
 * Creates a DB record in SupportTicket and sends an email notification
 * to the configured support address. Returns the ticket ID so the user
 * can track it.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 200)
  const description = requireString(body.description, 'Description', 5000)
  const priority = optionalString(body.priority, 'Priority', 20) ?? 'medium'
  const page = optionalString(body.page, 'Page', 500) ?? 'Unknown'
  const category = optionalString(body.category, 'Category', 30) ?? 'OTHER'

  const validPriorities = ['low', 'medium', 'high', 'critical']
  if (!validPriorities.includes(priority)) {
    throw new ValidationError('Priority must be low, medium, high, or critical')
  }

  const validCategories = ['BUG', 'FEATURE_REQUEST', 'QUESTION', 'ACCESS_ISSUE', 'OTHER']
  if (!validCategories.includes(category)) {
    throw new ValidationError('Invalid category')
  }

  // Optional screenshot as base64 data URL
  const screenshot = typeof body.screenshot === 'string' ? body.screenshot : null
  let screenshotUrl: string | null = null
  let attachments: { filename: string; content: Buffer }[] = []

  if (screenshot) {
    const match = screenshot.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/)
    if (match) {
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
      attachments = [{
        filename: `screenshot.${ext}`,
        content: Buffer.from(match[2], 'base64'),
      }]
      // Store the data URL for the ticket record (could be moved to Supabase Storage later)
      screenshotUrl = screenshot.slice(0, 500000) // cap at ~375KB base64
    }
  }

  // Map string priority to enum
  const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'CRITICAL',
  }
  const categoryMap: Record<string, 'BUG' | 'FEATURE_REQUEST' | 'QUESTION' | 'ACCESS_ISSUE' | 'OTHER'> = {
    BUG: 'BUG', FEATURE_REQUEST: 'FEATURE_REQUEST', QUESTION: 'QUESTION',
    ACCESS_ISSUE: 'ACCESS_ISSUE', OTHER: 'OTHER',
  }

  // 1. Save to database
  const ticket = await prisma.supportTicket.create({
    data: {
      organisationId: profile.organisationId,
      submitterId: profile.id,
      title,
      description,
      priority: priorityMap[priority] ?? 'MEDIUM',
      category: categoryMap[category] ?? 'OTHER',
      page,
      screenshotUrl,
    },
  })

  // 2. Send email notification
  const priorityEmoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[priority] || '🟡'
  const submitterName = profile.fullName || profile.email || 'Unknown user'
  const submitterEmail = profile.email || 'Unknown'
  // Fetch org name from DB
  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { name: true },
  })
  const orgName = org?.name || 'Unknown org'

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: FROM_EMAIL,
      to: SUPPORT_EMAIL,
      subject: `${priorityEmoji} [${priority.toUpperCase()}] #${ticket.id.slice(-6).toUpperCase()} — ${title}`,
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
<div style="background: #18181b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
  <h1 style="margin: 0; color: #fff; font-size: 18px;">🎫 Support Ticket #${ticket.id.slice(-6).toUpperCase()}</h1>
</div>
<div style="background: #fff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
    <tr><td style="padding: 8px 0; color: #666; width: 100px;">From</td><td style="padding: 8px 0; font-weight: 500;">${escHtml(submitterName)} (${escHtml(submitterEmail)})</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Organisation</td><td style="padding: 8px 0;">${escHtml(orgName)}</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Priority</td><td style="padding: 8px 0;">${priorityEmoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)}</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Category</td><td style="padding: 8px 0;">${category.replace('_', ' ')}</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Page</td><td style="padding: 8px 0;"><a href="${APP_URL}${escHtml(page)}" style="color: #2563eb;">${escHtml(page)}</a></td></tr>
  </table>
  <h2 style="font-size: 16px; margin: 0 0 8px; color: #18181b;">${escHtml(title)}</h2>
  <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escHtml(description)}</div>
  ${attachments.length > 0 ? '<p style="margin-top: 16px; font-size: 13px; color: #666;">📎 Screenshot attached</p>' : ''}
  <p style="margin-top: 20px; font-size: 12px; color: #999;">Ticket ID: ${ticket.id}</p>
</div>
</body></html>`,
      text: `Support Ticket #${ticket.id.slice(-6).toUpperCase()}: ${title}\n\nFrom: ${submitterName} (${submitterEmail})\nOrganisation: ${orgName}\nPriority: ${priority}\nCategory: ${category}\nPage: ${APP_URL}${page}\n\n${description}\n\nTicket ID: ${ticket.id}`,
      ...(attachments.length > 0 ? { attachments } : {}),
    })
  } catch (emailErr) {
    // Log but don't fail — ticket is already saved
    console.error('[SUPPORT] Email send failed:', emailErr)
  }

  return success({
    ticketId: ticket.id,
    ticketRef: `#${ticket.id.slice(-6).toUpperCase()}`,
    message: 'Your ticket has been submitted. You can track it under My Tickets.',
  }, 201)
})
