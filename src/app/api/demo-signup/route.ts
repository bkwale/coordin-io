import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/demo-signup
 *
 * Handles demo signup submissions:
 * 1. Validates the payload
 * 2. Sends confirmation email to the user (via Resend)
 * 3. Sends notification email to the Coordin team (via Resend)
 * 4. Optionally stores in Supabase waitlist table (when configured)
 *
 * Required env: RESEND_API_KEY
 * Optional env: TEAM_NOTIFICATION_EMAIL (defaults to team@coordin.io)
 */

const RESEND_API_URL = 'https://api.resend.com/emails'

interface SignupPayload {
  name: string
  email: string
  practice_name?: string
  practice_size?: string
  source?: string
}

function validatePayload(body: any): { valid: true; data: SignupPayload } | { valid: false; error: string } {
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return { valid: false, error: 'Name is required.' }
  }
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
    return { valid: false, error: 'A valid email is required.' }
  }
  return {
    valid: true,
    data: {
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      practice_name: body.practice_name?.trim() || undefined,
      practice_size: body.practice_size?.trim() || undefined,
      source: body.source || 'demo_signup',
    },
  }
}

/** Build the confirmation email HTML for the user. */
function buildUserEmail(data: SignupPayload): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e;">
  <div style="text-align: center; margin-bottom: 32px;">
    <div style="display: inline-block; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-size: 24px; line-height: 48px; font-weight: bold;">C</div>
  </div>
  <h1 style="font-size: 24px; font-weight: 600; text-align: center; margin-bottom: 8px;">Thanks for trying Coordin.io</h1>
  <p style="font-size: 15px; color: #64748b; text-align: center; margin-bottom: 32px;">
    Hi ${data.name.split(' ')[0]}, thanks for exploring the demo. We&rsquo;re excited to show you how Coordin.io can streamline your practice.
  </p>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
    <h3 style="font-size: 14px; font-weight: 600; margin: 0 0 12px 0;">What happens next?</h3>
    <ol style="font-size: 14px; color: #475569; padding-left: 20px; margin: 0;">
      <li style="margin-bottom: 8px;">Our team will review your details</li>
      <li style="margin-bottom: 8px;">We&rsquo;ll schedule a personalised demo within 24 hours</li>
      <li>You&rsquo;ll get full access to explore the platform with your own data</li>
    </ol>
  </div>
  <div style="text-align: center; margin-bottom: 32px;">
    <a href="https://coordin.io/book-demo" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600;">Book your demo now</a>
  </div>
  <p style="font-size: 12px; color: #94a3b8; text-align: center;">
    Coordin.io — Project control for the built environment<br/>
    <a href="https://coordin.io" style="color: #6366f1;">coordin.io</a>
  </p>
</body>
</html>`.trim()
}

/** Build the notification email HTML for the Coordin team. */
function buildTeamEmail(data: SignupPayload): string {
  const timestamp = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e;">
  <h2 style="font-size: 20px; margin-bottom: 16px;">New Demo Signup</h2>
  <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">${timestamp}</p>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px 0; font-weight: 600; width: 140px;">Name</td>
      <td style="padding: 10px 0;">${data.name}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px 0; font-weight: 600;">Email</td>
      <td style="padding: 10px 0;"><a href="mailto:${data.email}" style="color: #6366f1;">${data.email}</a></td>
    </tr>
    ${data.practice_name ? `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px 0; font-weight: 600;">Practice</td>
      <td style="padding: 10px 0;">${data.practice_name}</td>
    </tr>` : ''}
    ${data.practice_size ? `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px 0; font-weight: 600;">Team Size</td>
      <td style="padding: 10px 0;">${data.practice_size}</td>
    </tr>` : ''}
    <tr>
      <td style="padding: 10px 0; font-weight: 600;">Source</td>
      <td style="padding: 10px 0;">${data.source === 'demo_expired' ? 'Demo timer expired' : 'Direct signup'}</td>
    </tr>
  </table>
  <div style="margin-top: 24px; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
    <p style="font-size: 13px; color: #166534; margin: 0;">
      <strong>Action:</strong> Follow up within 24 hours to schedule their personalised demo.
    </p>
  </div>
</body>
</html>`.trim()
}

async function sendEmail(to: string, subject: string, html: string, apiKey: string, from: string): Promise<boolean> {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = validatePayload(body)

    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const { data } = result
    const apiKey = process.env.RESEND_API_KEY
    const teamEmail = process.env.TEAM_NOTIFICATION_EMAIL || 'wale@techsanctum.org'
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Coordin.io <noreply@coordin.io>'

    // If Resend is configured, send emails
    if (apiKey && apiKey !== 'your-resend-api-key-here') {
      // Send both emails in parallel
      const [userSent, teamSent] = await Promise.all([
        sendEmail(data.email, 'Thanks for trying Coordin.io — your demo is being prepared', buildUserEmail(data), apiKey, fromEmail),
        sendEmail(teamEmail, `New demo signup: ${data.name} (${data.email})`, buildTeamEmail(data), apiKey, fromEmail),
      ])

      if (!userSent && !teamSent) {
        console.error('[demo-signup] Both emails failed to send')
      }

      return NextResponse.json({
        ok: true,
        emails_sent: { user: userSent, team: teamSent },
      })
    }

    // No email service configured — log and return success anyway
    // (the user still gets the "success" UI; emails will work once RESEND_API_KEY is set)
    console.log('[demo-signup] No RESEND_API_KEY configured. Signup data:', JSON.stringify(data))

    return NextResponse.json({
      ok: true,
      emails_sent: { user: false, team: false },
      note: 'Email service not configured. Set RESEND_API_KEY in .env.local.',
    })
  } catch (err) {
    console.error('[demo-signup] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
