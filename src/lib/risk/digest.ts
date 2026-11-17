/**
 * Weekly risk digest: one email per person, listing the flags on the projects they lead.
 * Fixed rules only, no AI. Sent only for firms that have risk analysis on AND have switched the digest on.
 */
import { prisma } from '@/lib/prisma'
import { portfolioRisks, rankProjects, type ProjectRisk } from './portfolio'
import { parseRiskSettings } from './settings'
import { sendRiskDigestEmail } from '@/lib/email'
import { captureError } from '@/lib/error-reporting'

export const DIGEST_EVENT = 'risk.digest'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.coordin.io'
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export type DigestProject = Pick<ProjectRisk, 'id' | 'name' | 'counts' | 'top'>

/** Only projects with something high or medium go in. Nothing to say means no email at all. */
export function digestProjects(projects: DigestProject[]): DigestProject[] {
  return rankProjects(projects.filter((p) => p.counts.high + p.counts.medium > 0))
}

export function buildDigest(input: { firstName: string; organisationName: string; projects: DigestProject[]; appUrl?: string }): { subject: string; text: string; html: string } | null {
  const projects = digestProjects(input.projects)
  if (projects.length === 0) return null
  const url = input.appUrl ?? APP_URL
  const high = projects.reduce((n, p) => n + p.counts.high, 0), medium = projects.reduce((n, p) => n + p.counts.medium, 0)
  const subject = `Risks this week: ${high} high, ${medium} medium across ${plural(projects.length, 'project')}`
  const lines: string[] = [`Hi ${input.firstName},`, '', `Here is what Coordin is flagging on the projects you lead at ${input.organisationName}.`, '']
  const blocks: string[] = []
  for (const p of projects) {
    const link = `${url}/projects/${p.id}/risks`
    const more = p.counts.total - p.top.length
    lines.push(`${p.name}: ${p.counts.high} high, ${p.counts.medium} medium, ${p.counts.low} low`)
    for (const s of p.top) lines.push(`  - [${s.severity}] ${s.title}`)
    if (more > 0) lines.push(`  …and ${more} more`)
    lines.push(`  ${link}`, '')
    blocks.push(
      `<h3 style="margin:20px 0 4px;font-size:15px">${esc(p.name)}</h3>` +
      `<p style="margin:0 0 6px;color:#555;font-size:13px">${p.counts.high} high · ${p.counts.medium} medium · ${p.counts.low} low</p>` +
      `<ul style="margin:0 0 6px;padding-left:18px;font-size:13px">${p.top.map((s) => `<li><strong>${esc(s.severity)}</strong>: ${esc(s.title)}</li>`).join('')}${more > 0 ? `<li>…and ${more} more</li>` : ''}</ul>` +
      `<p style="margin:0;font-size:13px"><a href="${link}">Open the risks for this project</a></p>`,
    )
  }
  const foot = 'These come from fixed rules over what is entered in Coordin (tasks, milestones, permits, hours, documents). No AI is used. You can switch this email off under Settings → Notifications.'
  lines.push(foot)
  const html = `<div style="font-family:Arial,sans-serif;color:#222;max-width:600px"><p>Hi ${esc(input.firstName)},</p><p>Here is what Coordin is flagging on the projects you lead at ${esc(input.organisationName)}.</p>${blocks.join('')}<p style="margin-top:24px;color:#777;font-size:12px">${esc(foot)}</p></div>`
  return { subject, text: lines.join('\n'), html }
}

/** Does this person want the digest? On unless they switched its email off in their notification preferences. */
export function wantsDigest(preferences: unknown): boolean {
  const p = (preferences && typeof preferences === 'object' ? (preferences as Record<string, { email?: boolean } | undefined>)[DIGEST_EVENT] : undefined)
  return p?.email !== false
}

export async function runWeeklyRiskDigest(now: Date = new Date()) {
  const result = { organisations: 0, projects: 0, sent: 0, skippedNothingToSay: 0, skippedOptedOut: 0, errors: 0 }
  const enabled = await prisma.organisationFeature.findMany({ where: { featureKey: 'ai_risk', enabled: true }, select: { organisation: { select: { id: true, name: true, settings: true } } } })
  for (const { organisation: org } of enabled) {
    const settings = parseRiskSettings(org.settings)
    if (!settings.weeklyDigest) continue
    result.organisations++
    try {
      const { projects } = await portfolioRisks({ organisationId: org.id, profileId: null, seeAll: true, now, settings, top: 5 })
      result.projects += projects.length
      const flagged = projects.filter((p) => p.counts.high + p.counts.medium > 0)
      if (flagged.length === 0) continue
      const leads = await prisma.projectMembership.findMany({
        where: { projectId: { in: flagged.map((p) => p.id) }, projectRole: 'PROJECT_LEAD', removedAt: null, profile: { organisationId: org.id, status: 'ACTIVE', deactivatedAt: null } },
        select: { projectId: true, profile: { select: { id: true, email: true, fullName: true, notificationPreferences: true } } },
      })
      const byPerson = new Map<string, { profile: (typeof leads)[number]['profile']; projects: DigestProject[] }>()
      for (const m of leads) {
        const p = flagged.find((x) => x.id === m.projectId)
        if (!p) continue
        const entry = byPerson.get(m.profile.id) ?? { profile: m.profile, projects: [] }
        entry.projects.push({ id: p.id, name: p.name, counts: p.counts, top: p.top })
        byPerson.set(m.profile.id, entry)
      }
      for (const { profile, projects: mine } of byPerson.values()) {
        if (!wantsDigest(profile.notificationPreferences)) { result.skippedOptedOut++; continue }
        const mail = buildDigest({ firstName: profile.fullName.split(' ')[0] || profile.fullName, organisationName: org.name, projects: mine })
        if (!mail) { result.skippedNothingToSay++; continue }
        const r = await sendRiskDigestEmail({ to: profile.email, ...mail })
        if (r.success) result.sent++
        else { result.errors++; captureError(new Error(`Risk digest email failed: ${r.error}`), { source: 'cron', route: '/api/cron/risk-digest', organisationId: org.id }) }
      }
    } catch (e) {
      result.errors++
      captureError(e, { source: 'cron', route: '/api/cron/risk-digest', organisationId: org.id })
    }
  }
  return result
}
