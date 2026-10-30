import { NextRequest } from 'next/server'
import { success } from '@/lib/api-response'
import { withAuth } from '@/lib/with-auth'
import { searchMentionableUsers } from '@/lib/mentions'

/**
 * GET /api/mentions/search?q=John — Search for mentionable users.
 */
export const GET = withAuth(async (request: NextRequest, { profile }) => {
  const url = new URL(request.url)
  const query = url.searchParams.get('q') || ''

  if (query.length < 1) {
    return success({ users: [] })
  }

  const users = await searchMentionableUsers(profile.organisationId, query)
  return success({ users })
})
