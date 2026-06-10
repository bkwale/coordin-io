/**
 * Structured logging for the services layer.
 *
 * Every log includes: operation name, whether we're in demo mode,
 * and (on error) the Supabase error code + message.
 * Replaces raw console.error scattered across services.
 */

import { isSupabaseConfigured } from './config'

export type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  service: string
  operation: string
  demoMode: boolean
  message: string
  errorCode?: string
  meta?: Record<string, unknown>
}

function formatEntry(entry: LogEntry): string {
  const tag = `[services/${entry.service}]`
  const mode = entry.demoMode ? '[demo]' : '[live]'
  const code = entry.errorCode ? ` (${entry.errorCode})` : ''
  return `${tag} ${mode} ${entry.operation}${code}: ${entry.message}`
}

function emit(entry: LogEntry) {
  const formatted = formatEntry(entry)
  switch (entry.level) {
    case 'error':
      console.error(formatted, entry.meta ?? '')
      break
    case 'warn':
      console.warn(formatted, entry.meta ?? '')
      break
    default:
      console.log(formatted, entry.meta ?? '')
  }
}

/**
 * Create a scoped logger for a service file.
 *
 * Usage:
 *   const log = createServiceLogger('projects')
 *   log.error('getProjects', 'Connection refused', { code: 'PGRST301' })
 *   log.info('getProjects', 'Returned 12 rows')
 */
export function createServiceLogger(service: string) {
  const demoMode = !isSupabaseConfigured()

  return {
    info(operation: string, message: string, meta?: Record<string, unknown>) {
      emit({ level: 'info', service, operation, demoMode, message, meta })
    },
    warn(operation: string, message: string, meta?: Record<string, unknown>) {
      emit({ level: 'warn', service, operation, demoMode, message, meta })
    },
    error(
      operation: string,
      message: string,
      opts?: { code?: string; meta?: Record<string, unknown> }
    ) {
      emit({
        level: 'error',
        service,
        operation,
        demoMode,
        message,
        errorCode: opts?.code,
        meta: opts?.meta,
      })
    },
  }
}
