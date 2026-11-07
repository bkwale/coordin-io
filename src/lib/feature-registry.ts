/**
 * Feature registry — pure constants, no runtime imports.
 * Safe to import from client components, scripts, and tests.
 */

export const FEATURE_REGISTRY = {
  staffing:         { label: 'People & HR',           default: true,  description: 'Employee profiles, onboarding, leave, expenses, timesheets' },
  projects:         { label: 'Projects & Tasks',      default: true,  description: 'Project management, tasks, milestones, documents' },
  commercial:       { label: 'Commercial & Fees',     default: false, description: 'Fee quotes, commercial analytics, cost tracking' },
  timesheets:       { label: 'Timesheets',            default: false, description: 'Weekly timesheet entry and approval workflow' },
  spend_management: { label: 'Spend Management',      default: false, description: 'Procurement requests, corporate cards, budgets' },
  helpdesk:         { label: 'Support Tickets',       default: false, description: 'Internal helpdesk and ticket management' },
  compliance:       { label: 'Compliance & HSE',      default: false, description: 'Compliance tracking, HSE observations, site inspections' },
  documents:        { label: 'Document Management',   default: true,  description: 'Drawing register, document control, transmittals' },
  approvals:        { label: 'Approval Workflows',    default: true,  description: 'Multi-step approval routing for leave, expenses, requests' },
  invoicing:        { label: 'Invoicing',             default: false, description: 'Inbound invoice reception, parsing, categorisation, and accounting sync' },
  ai_fallback:      { label: 'AI backup reader (outside EU)', default: false, description: 'If the EU AI service is down, read documents with a US-hosted model instead. Names, emails, phone numbers and ID numbers are masked first. Off: you fill in by hand until the EU service is back.' },
  riba_tracking:    { label: 'RIBA Stage Tracking',   default: false, description: 'RIBA work stage gates, transition history, prerequisite validation, and resource planning' },
} as const

export type FeatureKey = keyof typeof FEATURE_REGISTRY
