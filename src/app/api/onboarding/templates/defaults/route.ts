import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { modulesPrisma } from '@/lib/prisma-modules'
import { parseBody } from '@/lib/validation'
import { PermissionError } from '@/lib/errors'
import { recordAuditEvent } from '@/lib/audit'
import { DEFAULT_TEMPLATES } from '@/lib/onboarding/default-templates'

/**
 * POST /api/onboarding/templates/defaults  { keys?: string[] }
 * Creates the standard seven-day core template and role add-ons for this organisation so HR can
 * edit them. Skips any template that already exists by name — safe to press twice.
 */
export const POST = withAuth(async (request: NextRequest, { profile }) => {
  if (!['ADMIN', 'OWNER', 'HR'].includes(profile.orgPermission)) {
    throw new PermissionError('Only HR and admins can create onboarding templates')
  }
  const body = await parseBody(request).catch(() => ({} as Record<string, unknown>))
  const wanted = Array.isArray(body.keys) ? new Set((body.keys as unknown[]).map(String)) : null
  const templates = DEFAULT_TEMPLATES.filter((t) => !wanted || wanted.has(t.key))

  const existing = await modulesPrisma.onboardingTemplate.findMany({
    where: { organisationId: profile.organisationId, isActive: true, name: { in: templates.map((t) => t.name) } },
    select: { name: true },
  })
  const have = new Set(existing.map((t: { name: string }) => t.name))

  const created: { id: string; name: string; kind: string; items: number }[] = []
  for (const t of templates) {
    if (have.has(t.name)) continue
    const tpl = await modulesPrisma.onboardingTemplate.create({
      data: {
        organisationId: profile.organisationId,
        name: t.name,
        kind: t.kind,
        roleLevel: t.roleLevel,
        description: t.description,
        isDefault: false,
        items: {
          create: t.items.map((i, idx) => ({
            stage: i.stage,
            category: i.category,
            title: i.title,
            responsibleRole: i.responsibleRole,
            appliesTo: i.appliesTo,
            daysFromStart: i.daysFromStart,
            actionRequired: !!i.actionRequired,
            acknowledgementRequired: !!i.acknowledgementRequired,
            sortOrder: idx,
          })),
        },
      },
      select: { id: true, name: true, kind: true },
    })
    created.push({ ...tpl, items: t.items.length })
  }

  if (created.length) {
    await recordAuditEvent({
      organisationId: profile.organisationId,
      actorId: profile.id,
      action: 'onboarding_template.defaults_created',
      entityType: 'OnboardingTemplate',
      entityId: created[0].id,
      metadata: { templates: created.map((c) => c.name) },
    })
  }

  return success({ created, skipped: templates.filter((t) => have.has(t.name)).map((t) => t.name) }, created.length ? 201 : 200)
})
