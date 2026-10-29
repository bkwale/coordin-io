import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { requireString, optionalString, parseBody } from '@/lib/validation'

/**
 * Custom knowledge articles stored in Organisation.settings.knowledgeArticles.
 *
 * GET  — return custom articles for this org
 * POST — add a new custom article (any logged-in user)
 */

interface KnowledgeArticle {
  id: string
  title: string
  category: string
  content: string
  tags: string[]
  createdAt: string
  createdBy: string
}

interface OrgSettingsShape {
  knowledgeArticles?: KnowledgeArticle[]
  [key: string]: unknown
}

export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { settings: true },
  })

  const settings = (org?.settings ?? {}) as OrgSettingsShape
  const articles = settings.knowledgeArticles ?? []

  return success({ articles })
})

export const POST = withAuth(async (request: NextRequest, { profile }) => {
  const body = await parseBody(request)

  const title = requireString(body.title, 'title', 200)
  const category = optionalString(body.category, 'category', 50) ?? 'Custom'
  const content = requireString(body.content, 'content', 10000)
  const tags: string[] = Array.isArray(body.tags) ? body.tags.map(String).slice(0, 20) : []

  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { settings: true },
  })

  const settings = (org?.settings ?? {}) as OrgSettingsShape
  const existing = settings.knowledgeArticles ?? []

  const article: KnowledgeArticle = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    category,
    content,
    tags,
    createdAt: new Date().toISOString(),
    createdBy: profile.fullName ?? profile.id,
  }

  const updated = [article, ...existing]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newSettings = { ...settings, knowledgeArticles: updated } as any

  await prisma.organisation.update({
    where: { id: profile.organisationId },
    data: { settings: newSettings },
  })

  return success({ article }, 201)
})
