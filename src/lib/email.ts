import { Resend } from 'resend'

// ── Resend Client ─────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Coordin.io <onboarding@resend.dev>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.coordin.io'

// ── Types ─────────────────────────────────────────────────

interface InvitationEmailParams {
  to: string
  inviteeName: string
  organisationName: string
  inviterName: string
  token: string
  expiresAt: Date
}

// ── Send Invitation Email ─────────────────────────────────

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, inviteeName, organisationName, inviterName, token, expiresAt } = params
  const activationUrl = `${APP_URL}/activate/${token}`
  const expiryDate = expiresAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `You're invited to join ${organisationName} on Coordin.io`,
      html: buildInvitationHtml({
        inviteeName,
        organisationName,
        inviterName,
        activationUrl,
        expiryDate,
      }),
      text: buildInvitationText({
        inviteeName,
        organisationName,
        inviterName,
        activationUrl,
        expiryDate,
      }),
    })

    if (error) {
      console.error('[EMAIL] Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown email error'
    console.error('[EMAIL] Send failed:', message)
    return { success: false, error: message }
  }
}

// ── HTML Template ─────────────────────────────────────────

function buildInvitationHtml(params: {
  inviteeName: string
  organisationName: string
  inviterName: string
  activationUrl: string
  expiryDate: string
}): string {
  const { inviteeName, organisationName, inviterName, activationUrl, expiryDate } = params

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#18181b;padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">Coordin.io</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;color:#18181b;font-size:16px;line-height:1.6;">
              Hi ${inviteeName},
            </p>
            <p style="margin:0 0 16px;color:#3f3f46;font-size:15px;line-height:1.6;">
              ${inviterName} has invited you to join <strong>${organisationName}</strong> on Coordin.io — a practice management platform for architecture and engineering firms.
            </p>
            <p style="margin:0 0 24px;color:#3f3f46;font-size:15px;line-height:1.6;">
              Click the button below to set up your account and get started.
            </p>
            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="background:#18181b;border-radius:8px;padding:14px 32px;">
                  <a href="${activationUrl}" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">
                    Accept Invitation
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;color:#71717a;font-size:13px;line-height:1.5;">
              This invitation expires on ${expiryDate}.
            </p>
            <p style="margin:0;color:#71717a;font-size:13px;line-height:1.5;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin:4px 0 0;word-break:break-all;">
              <a href="${activationUrl}" style="color:#2563eb;font-size:13px;">${activationUrl}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5;">
              You received this email because ${inviterName} invited you to ${organisationName}.
              If you weren't expecting this, you can safely ignore it.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Plain Text Fallback ───────────────────────────────────

function buildInvitationText(params: {
  inviteeName: string
  organisationName: string
  inviterName: string
  activationUrl: string
  expiryDate: string
}): string {
  const { inviteeName, organisationName, inviterName, activationUrl, expiryDate } = params

  return `Hi ${inviteeName},

${inviterName} has invited you to join ${organisationName} on Coordin.io.

Accept your invitation here: ${activationUrl}

This link expires on ${expiryDate}.

If you weren't expecting this email, you can safely ignore it.

— Coordin.io`
}
