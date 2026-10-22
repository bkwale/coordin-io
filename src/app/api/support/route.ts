import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, parseBody } from '@/lib/validation'
import { ValidationError } from '@/lib/errors'
import { Resend } from 'resend'

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'wale@techsanctum.org'
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Coordin.io <noreply@coordin.io>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.coordin.io'

/**
 * POST /api/support — Submit a support ticket.
 *
 * Sends an email to the configured support address with the user's report.
 * Accepts an optional base64 screenshot attachment.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'Title', 200)
  const description = requireString(body.description, 'Description', 5000)
  const priority = optionalString(body.priority, 'Priority', 20) ?? 'medium'
  const page = optionalString(body.page, 'Page', 500) ?? 'Unknown'

  const validPriorities = ['low', 'medium', 'high', 'critical']
  if (!validPriorities.includes(priority)) {
    throw new ValidationError('Priority must be low, medium, high, or critical')
  }

  // Optional screenshot as base64 data URL
  const screenshot = typeof body.screenshot === 'string' ? body.screenshot : null
  let attachments: { filename: string; content: Buffer }[] = []

  if (screenshot) {
    // Parse data:image/png;base64,... format
    const match = screenshot.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/)
    if (match) {
      const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
      attachments = [{
        filename: `screenshot.${ext}`,
        content: Buffer.from(match[2], 'base64'),
      }]
    }
  }

  const priorityEmoji = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[priority] || '🟡'
  const submitterName = profile.fullName || profile.email || 'Unknown user'
  const submitterEmail = profile.email || 'Unknown'
  const orgName = profile.organisationId ? 'CWA Homes' : 'Unknown org'

  const resend = new Resend(process.env.RESEND_API_KEY)

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: SUPPORT_EMAIL,
    subject: `${priorityEmoji} [${priority.toUpperCase()}] Support ticket: ${title}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
<div style="background: #18181b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
  <h1 style="margin: 0; color: #fff; font-size: 18px;">🎫 Support Ticket</h1>
</div>
<div style="background: #fff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
    <tr><td style="padding: 8px 0; color: #666; width: 100px;">From</td><td style="padding: 8px 0; font-weight: 500;">${submitterName} (${submitterEmail})</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Organisation</td><td style="padding: 8px 0;">${orgName}</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Priority</td><td style="padding: 8px 0;">${priorityEmoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)}</td></tr>
    <tr><td style="padding: 8px 0; color: #666;">Page</td><td style="padding: 8px 0;"><a href="${APP_URL}${page}" style="color: #2563eb;">${page}</a></td></tr>
  </table>
  <h2 style="font-size: 16px; margin: 0 0 8px; color: #18181b;">${title}</h2>
  <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${description}</div>
  ${attachments.length > 0 ? '<p style="margin-top: 16px; font-size: 13px; color: #666;">📎 Screenshot attached</p>' : ''}
</div>
</body></html>`,
    text: `Support Ticket: ${title}\n\nFrom: ${submitterName} (${submitterEmail})\nOrganisation: ${orgName}\nPriority: ${priority}\nPage: ${APP_URL}${page}\n\n${description}`,
    ...(attachments.length > 0 ? { attachments } : {}),
  })

  if (error) {
    console.error('[SUPPORT] Email send failed:', error)
    throw new Error('Failed to send support ticket. Please try again.')
  }

  return success({ sent: true, message: 'Your ticket has been submitted. We will get back to you shortly.' }, 201)
})
