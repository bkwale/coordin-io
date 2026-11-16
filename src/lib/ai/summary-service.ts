/**
 * Document summaries: the service behind the Summarise button.
 *  startSummary            : find the stored file of a project document, read it, create the AIRun
 *  latestSummary           : the newest summary run for a document (for the panel to show or poll)
 *  createTasksFromSummary  : a person confirms actions; only then do they become tasks (audited)
 */
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { assertAiBudget } from './budget'
import { readDocumentPages, SUMMARY_PROMPT_VERSION_FOR_RUNS, type SummaryMapping } from './summary-shared'
import { IngestError, SUMMARY_LIMITS } from './document-ingest'
import { parseFileLink } from '@/lib/storage-links'
import { recordAuditEvent, AuditActions } from '@/lib/audit'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { assertAssignable } from '@/lib/assignable'
import type { SummaryLanguage } from './prompts/summary'
import { parseRunInput, tasksMade, taskDraft, type SummaryRunInput, type TaskPick } from './summary-tasks'

export { parseRunInput, tasksMade, taskDraft, type SummaryRunInput, type TaskPick }

export const SUMMARY_KIND = 'summary'

/** Marker used to find a document's summary runs. Document ids are cuids, so the text match is exact. */
const marker = (documentId: string) => `"kind":"summary","documentId":"${documentId}"`

export interface StartSummaryInput { projectId: string; organisationId: string; authUserId: string; profileId: string; documentId: string; language: SummaryLanguage }

export async function startSummary(input: StartSummaryInput) {
  const { projectId, organisationId, authUserId, profileId, documentId, language } = input
  await assertAiBudget(organisationId)

  const document = await prisma.document.findFirst({
    where: { id: documentId, projectId },
    select: { id: true, title: true, revisions: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, revision: true, fileUrl: true } } },
  })
  if (!document) throw new NotFoundError('Document not found')
  const rev = document.revisions[0]
  if (!rev) throw new ValidationError('This document has no file yet.')
  const link = parseFileLink(rev.fileUrl)
  // Only our own storage, only this firm's and this project's folder. A link to SharePoint or anywhere else is never fetched.
  if (!link || link.bucket !== 'documents') throw new ValidationError('Only files stored in Coordin can be summarised. This document is a link to a file kept elsewhere.')
  const parts = link.path.split('/')
  if (parts[0] !== organisationId || parts[1] !== projectId || parts.some((p) => p === '..' || p === '.')) throw new ValidationError('This file does not belong to this project.')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new ValidationError('File storage is not configured')

  const fail = async (message: string) => {
    // A file we could not read still counts against today's AI allowance, so bad files can't be sent endlessly
    await prisma.aIRun.create({
      data: {
        surface: 'EXTRACTION', organisationId, projectId, status: 'FAILED', promptVersion: SUMMARY_PROMPT_VERSION_FOR_RUNS, inputHash: '',
        inputSummary: JSON.stringify({ kind: SUMMARY_KIND, documentId, revisionId: rev.id, revision: rev.revision, title: document.title, rejected: true }),
        createdBy: authUserId, stages: [], error: message.slice(0, 500), errorKind: 'input',
      },
    }).catch(() => {})
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: blob, error } = await admin.storage.from(link.bucket).download(link.path)
  if (error || !blob) throw new NotFoundError('The file could not be found in storage.')
  if (blob.size > SUMMARY_LIMITS.maxBytes) {
    const message = `This file is over ${Math.round(SUMMARY_LIMITS.maxBytes / 1024 / 1024)} MB, which is more than Coordin summarises.`
    await fail(message)
    throw new ValidationError(message)
  }
  let read
  try {
    read = await readDocumentPages(new Uint8Array(await blob.arrayBuffer()), link.path)
  } catch (e) {
    const message = e instanceof IngestError ? e.message : 'The file could not be read.'
    await fail(message)
    throw new ValidationError(message)
  }

  const summary: SummaryRunInput = { kind: SUMMARY_KIND, documentId, revisionId: rev.id, revision: rev.revision, title: document.title, pages: read.pages.length, language, truncated: read.truncated, format: read.format }
  const run = await prisma.aIRun.create({
    data: { surface: 'EXTRACTION', organisationId, projectId, status: 'QUEUED', promptVersion: SUMMARY_PROMPT_VERSION_FOR_RUNS, inputHash: '', inputSummary: JSON.stringify(summary), createdBy: authUserId, stages: [] },
  })
  await recordAuditEvent({ organisationId, actorId: profileId, action: AuditActions.AI_SUMMARY_RUN, entityType: 'document', entityId: documentId, metadata: { runId: run.id, projectId, revision: rev.revision, pages: read.pages.length } }).catch(() => {})
  return { run, pages: read.pages, truncated: read.truncated }
}

export async function latestSummary(projectId: string, documentId: string) {
  return prisma.aIRun.findFirst({
    where: { projectId, surface: 'EXTRACTION', inputSummary: { contains: marker(documentId) } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, stages: true, mapping: true, citations: true, error: true, errorKind: true, latencyMs: true, model: true, inputSummary: true, createdAt: true, confidence: true },
  })
}

export async function createTasksFromSummary(input: { runId: string; projectId: string; documentId: string; organisationId: string; profileId: string; authUserId: string; picks: TaskPick[] }) {
  const { runId, projectId, documentId, organisationId, profileId, authUserId, picks } = input
  if (picks.length === 0) throw new ValidationError('Choose at least one action.')
  if (picks.length > 40) throw new ValidationError('Too many actions at once.')
  await assertAssignable(organisationId, picks.map((p) => p.ownerId))

  const result = await prisma.$transaction(async (tx) => {
    // Lock the run row so two clicks cannot both create the same tasks
    await tx.$queryRaw`SELECT id FROM ai_runs WHERE id = ${runId} FOR UPDATE`
    const run = await tx.aIRun.findFirst({ where: { id: runId, projectId, surface: 'EXTRACTION', status: { in: ['AWAITING_CONFIRMATION', 'APPLIED'] }, inputSummary: { contains: marker(documentId) } } })
    if (!run) throw new NotFoundError('Summary not found')
    const mapping = run.mapping as unknown as SummaryMapping | null
    if (!mapping || mapping.kind !== 'summary' || !Array.isArray(mapping.actions)) throw new ValidationError('This summary has no actions.')
    const title = parseRunInput(run.inputSummary).title ?? 'document'
    const made = tasksMade(run.citations)
    const created: Array<{ index: number; taskId: string; title: string }> = []
    const skipped: number[] = []
    for (const pick of picks) {
      const action = mapping.actions[pick.index]
      if (!action) throw new ValidationError('That action is not in this summary.')
      if (made[String(pick.index)]) { skipped.push(pick.index); continue }
      const draft = taskDraft(action, title)
      const task = await tx.task.create({ data: { projectId, title: draft.title, description: draft.description, ownerId: pick.ownerId, dueDate: pick.dueDate, priority: 'MEDIUM' }, select: { id: true, title: true } })
      made[String(pick.index)] = task.id
      created.push({ index: pick.index, taskId: task.id, title: task.title })
    }
    if (created.length > 0) {
      await tx.aIRun.update({
        where: { id: run.id },
        data: { citations: { ...(run.citations && typeof run.citations === 'object' ? (run.citations as object) : {}), tasks: made }, status: 'APPLIED', confirmedBy: authUserId, confirmedAt: new Date(), appliedAt: new Date() },
      })
      for (const c of created) {
        await recordAuditEvent({ organisationId, actorId: profileId, action: AuditActions.TASK_CREATED, entityType: 'task', entityId: c.taskId, metadata: { title: c.title, projectId, fromSummaryRun: run.id } }, tx)
      }
      await recordAuditEvent({ organisationId, actorId: profileId, action: AuditActions.AI_SUMMARY_TASKS_CREATED, entityType: 'document', entityId: documentId, metadata: { runId: run.id, projectId, tasks: created.map((c) => c.taskId), offered: mapping.actions.length } }, tx)
    }
    return { created, skipped, made }
  }, { timeout: 20_000 })
  return result
}
