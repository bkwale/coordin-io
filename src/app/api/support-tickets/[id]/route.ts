import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { prisma } from '@/lib/prisma'
import { hasOrgPermission } from '@/lib/permissions'
import { requireString, optionalString, parseBody } from '@/lib/validation'
import { NotFoundError, PermissionError, ValidationError } from '@/lib/errors'
import { Resend } from 'resend'
import type { OrgPermission } from '@/generated/prisma/client'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Coordin.io <noreply@coordin.io>'

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * GET /api/support-tickets/[id] — Ticket detail with replies.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.split('/support-tickets/')[1]?.split('?')[0]
  if (!id) throw new NotFoundError('Ticket not found')

  const isAdmin = hasOrgPermission(
    profile.orgPermission as OrgPermission,
    'ADMIN'
  )

  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id,
      organisationId: profile.organisationId,
      // Non-admins can only see their own tickets
      ...(!isAdmin ? { submitterId: profile.id } : {}),
    },
    include: {
      submitter: { select: { id: true, fullName: true, email: true } },
      replies: {
        include: {
          author: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!ticket) throw new NotFoundError('Ticket not found')

  return success({
    ticket: {
      id: ticket.id,
      ref: `#${ticket.id.slice(-6).toUpperCase()}`,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      page: ticket.page,
      screenshotUrl: ticket.screenshotUrl,
      submitter: ticket.submitter,
      replies: ticket.replies.map((r: any) => ({
        id: r.id,
        message: r.message,
        isStaff: r.isStaff,
        author: r.author,
        createdAt: r.createdAt,
      })),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
    },
  })
})

/**
 * PATCH /api/support-tickets/[id] — Update ticket status or add a reply.
 *
 * Body options:
 *   { status: "IN_PROGRESS" | "RESOLVED" | "CLOSED" }   — admin only
 *   { reply: "message text" }                              — anyone with access
 *   Both can be sent together.
 */
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  const id = request.url.split('/support-tickets/')[1]?.split('?')[0]
  if (!id) throw new NotFoundError('Ticket not found')

  const isAdmin = hasOrgPermission(
    profile.orgPermission as OrgPermission,
    'ADMIN'
  )

  // Verify ticket exists and user has access
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id,
      organisationId: profile.organisationId,
      ...(!isAdmin ? { submitterId: profile.id } : {}),
    },
    include: {
      submitter: { select: { id: true, fullName: true, email: true } },
    },
  })

  if (!ticket) throw new NotFoundError('Ticket not found')

  const body = await parseBody(request)
  const newStatus = optionalString(body.status, 'Status', 20)
  const replyMessage = optionalString(body.reply, 'Reply', 5000)

  if (!newStatus && !replyMessage) {
    throw new ValidationError('Provide a status update or reply message')
  }

  // Status changes are admin-only
  if (newStatus && !isAdmin) {
    throw new PermissionError('Only admins can update ticket status')
  }

  const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
  if (newStatus && !validStatuses.includes(newStatus)) {
    throw new ValidationError('Invalid status')
  }

  // Update status if provided
  if (newStatus) {
    await prisma.supportTicket.update({
      where: { id },
      data: {
        status: newStatus as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
        ...(newStatus === 'RESOLVED' || newStatus === 'CLOSED'
          ? { resolvedAt: new Date() }
          : { resolvedAt: null }),
      },
    })
  }

  // Add reply if provided
  let reply = null
  if (replyMessage) {
    reply = await prisma.supportTicketReply.create({
      data: {
        ticketId: id,
        authorId: profile.id,
        message: replyMessage,
        isStaff: isAdmin,
      },
    })

    // If the reply is from admin/staff, email the submitter
    if (isAdmin && ticket.submitter.email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: FROM_EMAIL,
          to: ticket.submitter.email,
          subject: `Re: ${ticket.title} — Ticket ${`#${ticket.id.slice(-6).toUpperCase()}`}`,
          html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
<div style="background: #18181b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
  <h1 style="margin: 0; color: #fff; font-size: 18px;">💬 Reply to your ticket</h1>
</div>
<div style="background: #fff; padding: 32px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
  <p style="font-size: 14px; color: #666;">Ticket: <strong>${escHtml(ticket.title)}</strong></p>
  ${newStatus ? `<p style="font-size: 14px; color: #666;">Status updated to: <strong>${newStatus.replace('_', ' ')}</strong></p>` : ''}
  <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin-top: 16px;">${escHtml(replyMessage)}</div>
  <p style="margin-top: 20px; font-size: 12px; color: #999;">You can view and reply to this ticket in Coordin.io under My Tickets.</p>
</div>
</body></html>`,
          text: `Reply to: ${ticket.title}\n\n${replyMessage}\n\nView in Coordin.io under My Tickets.`,
        })
      } catch (emailErr) {
        console.error('[SUPPORT] Reply email failed:', emailErr)
      }
    }
  }

  return success({
    updated: true,
    ...(newStatus ? { status: newStatus } : {}),
    ...(reply ? { replyId: reply.id } : {}),
  })
})
