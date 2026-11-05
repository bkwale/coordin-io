/**
 * Starter onboarding templates built from Ayo's framework (bug report 10, sections 1.2–1.6).
 * HR creates these from Settings → Onboarding with one click and then edits them; nothing is
 * written to an organisation until HR asks. Wording is a draft for CWA to confirm.
 */
import type { AppliesTo, ResponsibleRole } from './seven-day'

export interface DefaultItem {
  title: string
  category: string
  responsibleRole: ResponsibleRole
  appliesTo: AppliesTo
  stage: string
  daysFromStart: number
  acknowledgementRequired?: boolean
  actionRequired?: boolean
}

export interface DefaultTemplate {
  key: string
  name: string
  kind: 'CORE' | 'ADDON'
  roleLevel: string | null
  description: string
  items: DefaultItem[]
}

const E = 'EMPLOYEE', HR = 'HR', M = 'MANAGER', IT = 'IT', A = 'ACCOUNTS'

export const CORE_TEMPLATE: DefaultTemplate = {
  key: 'core',
  name: 'Standard 7-day onboarding (core)',
  kind: 'CORE',
  roleLevel: null,
  description: 'Applied to every employee. New starters and existing staff joining Coordin see different employee steps; the seven-day window covers employee steps only.',
  items: [
    // Employee Details
    { title: 'Verify personal and residential details', category: 'Employee Details', responsibleRole: E, appliesTo: 'ALL', stage: 'BEFORE_START', daysFromStart: 2, actionRequired: true },
    { title: 'Enter emergency contact details', category: 'Employee Details', responsibleRole: E, appliesTo: 'ALL', stage: 'BEFORE_START', daysFromStart: 2, actionRequired: true },
    { title: 'Check personal and emergency information is complete', category: 'Employee Details', responsibleRole: HR, appliesTo: 'ALL', stage: 'DAY_ONE', daysFromStart: 7 },
    // Employment Documents
    { title: 'Issue employment contract and agreements', category: 'Employment Documents', responsibleRole: HR, appliesTo: 'NEW', stage: 'BEFORE_START', daysFromStart: 0 },
    { title: 'Review and sign employment contract', category: 'Employment Documents', responsibleRole: E, appliesTo: 'NEW', stage: 'BEFORE_START', daysFromStart: 5, actionRequired: true },
    { title: 'Assign employee handbook and company policies', category: 'Employment Documents', responsibleRole: HR, appliesTo: 'ALL', stage: 'BEFORE_START', daysFromStart: 0 },
    { title: 'Acknowledge company policies', category: 'Employment Documents', responsibleRole: E, appliesTo: 'ALL', stage: 'DAY_ONE', daysFromStart: 5, acknowledgementRequired: true },
    { title: 'Verify existing employment details (start date, role, service history)', category: 'Employment Documents', responsibleRole: E, appliesTo: 'EXISTING', stage: 'BEFORE_START', daysFromStart: 3, actionRequired: true },
    // Payroll
    { title: 'Submit bank and payroll details', category: 'Payroll', responsibleRole: E, appliesTo: 'NEW', stage: 'BEFORE_START', daysFromStart: 3, actionRequired: true },
    { title: 'Verify payroll information', category: 'Payroll', responsibleRole: A, appliesTo: 'NEW', stage: 'DAY_ONE', daysFromStart: 7 },
    // IT & Equipment
    { title: 'Create accounts and software access', category: 'IT & Equipment', responsibleRole: IT, appliesTo: 'NEW', stage: 'BEFORE_START', daysFromStart: 0 },
    { title: 'Prepare and hand over equipment', category: 'IT & Equipment', responsibleRole: IT, appliesTo: 'NEW', stage: 'DAY_ONE', daysFromStart: 1 },
    { title: 'Confirm equipment received', category: 'IT & Equipment', responsibleRole: E, appliesTo: 'NEW', stage: 'DAY_ONE', daysFromStart: 2, acknowledgementRequired: true },
    { title: 'Confirm equipment already issued to you', category: 'IT & Equipment', responsibleRole: E, appliesTo: 'EXISTING', stage: 'DAY_ONE', daysFromStart: 5, acknowledgementRequired: true },
    // Induction & Training
    { title: 'Office orientation and team introductions', category: 'Induction & Training', responsibleRole: M, appliesTo: 'NEW', stage: 'DAY_ONE', daysFromStart: 1 },
    { title: 'Agree responsibilities, expectations and initial objectives', category: 'Induction & Training', responsibleRole: M, appliesTo: 'NEW', stage: 'DAY_ONE', daysFromStart: 7 },
    { title: 'Complete the Coordin introduction and training', category: 'Induction & Training', responsibleRole: E, appliesTo: 'ALL', stage: 'DAY_ONE', daysFromStart: 6 },
    // Final Verification
    { title: 'Submit onboarding for HR verification', category: 'Final Verification', responsibleRole: E, appliesTo: 'ALL', stage: 'DAY_ONE', daysFromStart: 7, actionRequired: true },
    { title: 'Confirm mandatory requirements are complete', category: 'Final Verification', responsibleRole: HR, appliesTo: 'ALL', stage: 'DAY_ONE', daysFromStart: 10 },
  ],
}

const addon = (key: string, name: string, roleLevel: string, items: Array<[string, ResponsibleRole]>): DefaultTemplate => ({
  key, name, kind: 'ADDON', roleLevel,
  description: `Role-specific tasks added on top of the core template for ${roleLevel}.`,
  items: items.map(([title, responsibleRole], i) => ({
    title, responsibleRole, category: 'Induction & Training', appliesTo: 'ALL' as const, stage: 'ROLE_SPECIFIC', daysFromStart: 7 + i * 2,
  })),
})

export const ADDON_TEMPLATES: DefaultTemplate[] = [
  addon('architect', 'Add-on: Architect / Architectural Designer', 'Architect', [
    ['Design standards briefing', M], ['CAD / BIM standards and software setup', IT], ['Document control procedure', M], ['Project delivery framework (G0–G10) walkthrough', M],
  ]),
  addon('pm', 'Add-on: Project Manager', 'Project Manager', [
    ['Reporting and programme management briefing', M], ['Consultant coordination procedures', M], ['Approvals and sign-off responsibilities', M],
  ]),
  addon('site', 'Add-on: Site / Construction Staff', 'Site Staff', [
    ['Health, safety and environment induction', M], ['Inspection and site reporting procedures', M], ['Quality procedures', M], ['Contractor coordination briefing', M],
  ]),
  addon('accounts', 'Add-on: Accounts / Procurement', 'Accounts', [
    ['Financial controls briefing', M], ['Purchasing procedures', M], ['Approval responsibilities and limits', HR],
  ]),
  addon('hr-admin', 'Add-on: HR / Administration', 'HR / Admin', [
    ['Staffing and employee records procedures', HR], ['Administrative procedures', M], ['Confidential data handling', HR],
  ]),
]

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [CORE_TEMPLATE, ...ADDON_TEMPLATES]
