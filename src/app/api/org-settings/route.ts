import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { ValidationError } from '@/lib/errors'
import { hasOrgPermission } from '@/lib/permissions'

/**
 * Organisation settings shape stored in the `settings` JSON column:
 * {
 *   regional: { timezone, dateFormat, numberFormat, weekStart, language },
 *   numbering: {
 *     project: { format, active },
 *     quote: { format, active },
 *     drawing: { format, active },
 *   }
 * }
 */

interface RegionalSettings {
  timezone?: string
  dateFormat?: string
  numberFormat?: string
  weekStart?: string
  language?: string
}

interface NumberingTemplate {
  format?: string
  active?: boolean
}

interface NumberingSettings {
  project?: NumberingTemplate
  quote?: NumberingTemplate
  drawing?: NumberingTemplate
}

interface OrgSettings {
  regional?: RegionalSettings
  numbering?: NumberingSettings
}

const VALID_TIMEZONES = [
  'Europe/London', 'Europe/Berlin', 'America/New_York', 'Africa/Lagos', 'Asia/Dubai',
]

const VALID_DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'D MMM YYYY']
const VALID_NUMBER_FORMATS = ['en-GB', 'de-DE']
const VALID_WEEK_STARTS = ['monday', 'sunday']
const VALID_LANGUAGES = ['en']

const DEFAULTS: OrgSettings = {
  regional: {
    timezone: 'Europe/London',
    dateFormat: 'DD/MM/YYYY',
    numberFormat: 'en-GB',
    weekStart: 'monday',
    language: 'en',
  },
  numbering: {
    project: { format: '{OFFICE}-{YEAR}-{SEQ:3}', active: true },
    quote: { format: 'Q-{YEAR}-{SEQ:3}', active: true },
    drawing: { format: '{PROJECT}-{SEQ:2}', active: true },
  },
}

function mergeDefaults(stored: OrgSettings): OrgSettings {
  return {
    regional: { ...DEFAULTS.regional, ...stored.regional },
    numbering: {
      project: { ...DEFAULTS.numbering!.project, ...stored.numbering?.project },
      quote: { ...DEFAULTS.numbering!.quote, ...stored.numbering?.quote },
      drawing: { ...DEFAULTS.numbering!.drawing, ...stored.numbering?.drawing },
    },
  }
}

// ── GET /api/org-settings ──────────────────────────────
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { settings: true },
  })

  const stored = (org?.settings as OrgSettings) ?? {}
  return success({ settings: mergeDefaults(stored) })
})

// ── PATCH /api/org-settings ────────────────────────────
// Requires ADMIN or OWNER
export const PATCH = withAuth(async (request: NextRequest, { profile }) => {
  if (!hasOrgPermission(profile.orgPermission, 'ADMIN')) {
    throw new ValidationError('Only admins can update organisation settings')
  }

  const body = await request.json()
  const incoming: OrgSettings = body.settings

  if (!incoming || typeof incoming !== 'object') {
    throw new ValidationError('Missing or invalid "settings" object')
  }

  // Validate regional settings if provided
  if (incoming.regional) {
    const r = incoming.regional
    if (r.timezone && !VALID_TIMEZONES.includes(r.timezone)) {
      throw new ValidationError(`Invalid timezone: ${r.timezone}`)
    }
    if (r.dateFormat && !VALID_DATE_FORMATS.includes(r.dateFormat)) {
      throw new ValidationError(`Invalid date format: ${r.dateFormat}`)
    }
    if (r.numberFormat && !VALID_NUMBER_FORMATS.includes(r.numberFormat)) {
      throw new ValidationError(`Invalid number format: ${r.numberFormat}`)
    }
    if (r.weekStart && !VALID_WEEK_STARTS.includes(r.weekStart)) {
      throw new ValidationError(`Invalid week start: ${r.weekStart}`)
    }
    if (r.language && !VALID_LANGUAGES.includes(r.language)) {
      throw new ValidationError(`Invalid language: ${r.language}`)
    }
  }

  // Validate numbering templates if provided
  if (incoming.numbering) {
    for (const [key, tmpl] of Object.entries(incoming.numbering)) {
      if (!['project', 'quote', 'drawing'].includes(key)) {
        throw new ValidationError(`Unknown numbering type: ${key}`)
      }
      if (tmpl && typeof tmpl !== 'object') {
        throw new ValidationError(`Invalid numbering template for ${key}`)
      }
      if (tmpl?.format !== undefined && typeof tmpl.format !== 'string') {
        throw new ValidationError(`Format must be a string for ${key}`)
      }
      if (tmpl?.active !== undefined && typeof tmpl.active !== 'boolean') {
        throw new ValidationError(`Active must be a boolean for ${key}`)
      }
    }
  }

  // Merge with existing
  const org = await prisma.organisation.findUnique({
    where: { id: profile.organisationId },
    select: { settings: true },
  })

  const existing = (org?.settings as OrgSettings) ?? {}
  const merged: OrgSettings = {
    regional: { ...existing.regional, ...incoming.regional },
    numbering: {
      project: { ...existing.numbering?.project, ...incoming.numbering?.project },
      quote: { ...existing.numbering?.quote, ...incoming.numbering?.quote },
      drawing: { ...existing.numbering?.drawing, ...incoming.numbering?.drawing },
    },
  }

  await prisma.organisation.update({
    where: { id: profile.organisationId },
    data: { settings: JSON.parse(JSON.stringify(merged)) },
  })

  return success({ settings: mergeDefaults(merged) })
})
