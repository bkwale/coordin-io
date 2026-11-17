/**
 * Weekly risk digest: one email per person, listing the flags on the projects they lead.
 * Fixed rules only, no AI. Sent only for firms that have risk analysis on AND have switched the digest on.
 */
import { prisma } from '@/lib/prisma'
import { portfolioRisks, rankProjects, type ProjectRisk } from './portfolio'
import { parseRiskSettings } from './settings'
import { sendRiskDigestEmail } from '@/lib/email'
import { captureError } from '@/lib/error-reporting'
import { recordAuditEvent, AuditActions } from '@/lib/audit'

export const DIGEST_EVENT = 'risk.digest'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.coordin.io'
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** The Monday (UTC) of the week `now` falls in, as YYYY-MM-DD. One digest per firm per week is keyed on this. */
export function weekKey(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
const digestEntity = (organisationId: string, week: string) => `${organisationId}:${week}`

export type DigestProject = Pick<ProjectRisk, 'id' | 'name' | 'counts' | 'top'>

/** Only projects with something high or medium go in. Nothing to say means no email at all. */
export function digestProjects(projects: DigestProject[]): DigestProject[] {
  return rankProjects(projects.filter((p) => p.counts.high + p.counts.medium > 0))
}

export function buildDigest(input: { firstName: string; organisationName: string; projects: DigestProject[]; appUrl?: string; test?: boolean; scope?: string }): { subject: string; text: string; html: string } | null {
  const projects = digestProjects(input.projects)
  if (projects.length === 0) return null
  const url = input.appUrl ?? APP_URL
  const high = projects.reduce((n, p) => n + p.counts.high, 0), medium = projects.reduce((n, p) => n + p.counts.medium, 0)
  const scope = input.scope ?? 'the projects you lead'
  const subject = `${input.test ? '[Test] ' : ''}Risks this week: ${high} high, ${medium} medium across ${plural(projects.length, 'project')}`
  const lines: string[] = [`Hi ${input.firstName},`, '', `Here is what Coordin is flagging on ${scope} at ${input.organisationName}.`, '']
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
  const testNote = input.test ? 'This is a test you sent to yourself from Settings. The real email goes to each project lead on Monday morning, and only lists the projects they lead. ' : ''
  const foot = testNote + 'These come from fixed rules over what is entered in Coordin (tasks, milestones, permits, hours, documents). No AI is used. You can switch this email off under Settings → Notifications.'
  lines.push(foot)
  const html = `<div style="font-family:Arial,sans-serif;color:#222;max-width:600px"><p>Hi ${esc(input.firstName)},</p><p>Here is what Coordin is flagging on ${esc(scope)} at ${esc(input.organisationName)}.</p>${blocks.join('')}<p style="margin-top:24px;color:#777;font-size:12px">${esc(foot)}</p></div>`
  return { subject, text: lines.join('\n'), html }
}

/** Does this person want the digest? On unless they switched its email off in their notification preferences. */
export function wantsDigest(preferences: unknown): boolean {
  const p = (preferences && typeof preferences === 'object' ? (preferences as Record<string, { email?: boolean } | undefined>)[DIGEST_EVENT] : undefined)
  return p?.email !== false
}

export async function runWeeklyRiskDigest(now: Date = new Date()) {
  const result = { organisations: 0, projects: 0, sent: 0, skippedNothingToSay: 0, skippedOptedOut: 0, skippedAlreadySent: 0, errors: 0 }
  const enabled = await prisma.organisationFeature.findMany({ where: { featureKey: 'ai_risk', enabled: true }, select: { organisation: { select: { id: true, name: true, settings: true } } } })
  for (const { organisation: org } of enabled) {
    const settings = parseRiskSettings(org.settings)
    if (!settings.weeklyDigest) continue
    result.organisations++
    try {
      // One digest per firm per week. The marker is written before anything is sent, so a second run of the job
      // in the same week finds it and stops, rather than emailing everyone again.
      const week = weekKey(now)
      const already = await prisma.auditEvent.findFirst({ where: { organisationId: org.id, action: AuditActions.RISK_DIGEST_SENT, entityType: 'risk_digest', entityId: digestEntity(org.id, week) }, select: { id: true } })
      if (already) { result.skippedAlreadySent++; continue }
      await recordAuditEvent({ organisationId: org.id, action: AuditActions.RISK_DIGEST_SENT, entityType: 'risk_digest', entityId: digestEntity(org.id, week), metadata: { week } })
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

/**
 * A test of the digest, sent only to the person who asked for it. It lists every project they can see (an admin sees
 * all of the firm's), so there is something to look at even if they lead none. Does not count as the week's digest.
 */
export async function sendTestDigest(input: { organisationId: string; profileId: string; seeAll: boolean; now?: Date }) {
  const [org, profile] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: input.organisationId }, select: { name: true, settings: true } }),
    prisma.profile.findFirst({ where: { id: input.profileId, organisationId: input.organisationId }, select: { email: true, fullName: true } }),
  ])
  if (!org || !profile?.email) return { sent: false as const, reason: 'no_address' as const }
  const { projects } = await portfolioRisks({ organisationId: input.organisationId, profileId: input.profileId, seeAll: input.seeAll, now: input.now, settings: parseRiskSettings(org.settings), top: 5 })
  const mail = buildDigest({ firstName: profile.fullName.split(' ')[0] || profile.fullName, organisationName: org.name, projects: projects.map((p) => ({ id: p.id, name: p.name, counts: p.counts, top: p.top })), test: true, scope: 'the projects you can see' })
  if (!mail) return { sent: false as const, reason: 'nothing_flagged' as const }
  const r = await sendRiskDigestEmail({ to: profile.email, ...mail })
  if (!r.success) return { sent: false as const, reason: 'send_failed' as const, error: r.error }
  return { sent: true as const, to: profile.email, subject: mail.subject }
}
