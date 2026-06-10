/**
 * Coordin.io — Services Layer v2
 *
 * Abstraction over data access. When Supabase is configured (env vars present),
 * services query the real database. Otherwise they return mock data — preserving
 * the timed demo experience and local dev without credentials.
 *
 * v2 changes (Purple Team review):
 * - ServiceResult<T> return type: { data, error } — callers can show error states
 * - Dependency injection: pass a server Supabase client from Server Components
 * - Pagination: limit/offset on all list queries (default 100)
 * - Circuit breaker: 3 failures in 30s → skip Supabase for 60s
 * - Query timeout: 5s AbortController on every query
 * - Structured logging: service/operation/mode/error code
 * - organisation_id on all org-scoped inserts
 * - Error ≠ mock data: Supabase errors surface to callers, never fall back to demo data
 * - Explicit column selection on all queries
 *
 * Usage:
 *   import { getProjects, type ServiceResult } from '@/lib/services'
 *   const { data: projects, error } = await getProjects()
 *   if (error) showError(error)
 *
 * Server Component usage:
 *   import { createServerSupabaseClient } from '@/lib/supabase/server'
 *   const client = createServerSupabaseClient()
 *   const { data } = await getProjects({ client })
 */

// Types & configuration
export { isSupabaseConfigured, resetConfigCache, getOrgId } from './config'
export type { ServiceResult, QueryOptions } from './config'

// Logging & resilience (for advanced consumers / testing)
export { createServiceLogger } from './logger'
export {
  isCircuitOpen,
  recordFailure,
  recordSuccess,
  resetCircuitBreaker,
  queryTimeout,
} from './resilience'

// Core entities
export {
  getProjects,
  getProject,
  getProjectsByStatus,
  createProject,
  updateProject,
} from './projects'

export {
  getTasks,
  getTasksByProject,
  getTask,
  getOverdueTasks,
  createTask,
  updateTask,
} from './tasks'

export {
  getQuotes,
  getQuote,
  getQuoteLineItems,
  getQuoteTemplates,
  createQuote,
  updateQuote,
} from './quotes'

export {
  getTimesheetEntries,
  getTimesheetsByUser,
  getTimesheetsByProject,
  getTimesheetsByWeek,
  createTimesheetEntry,
  updateTimesheetEntry,
} from './timesheets'

export {
  getInvoices,
  getInvoice,
  getInvoicesByProject,
  getOverdueInvoices,
  createInvoice,
  updateInvoiceStatus,
} from './invoices'

export {
  getLeaveRecords,
  getLeaveByUser,
  getPendingLeave,
  createLeaveRequest,
  updateLeaveStatus,
} from './leave'

export {
  getWaitlistEntries,
  addToWaitlist,
} from './waitlist'

export {
  getProfiles,
  getProfile,
  getCurrentProfile,
  updateProfile,
} from './profiles'
