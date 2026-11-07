import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { bookableProjects } from '@/lib/timesheets/bookable-projects'

export const dynamic = 'force-dynamic'

/** GET /api/timesheets/projects — every active project in the organisation, for the timesheet project picker. */
export const GET = withAuth(async (_request: NextRequest, { profile }) => {
  return success({ projects: await bookableProjects(profile.organisationId) })
})
