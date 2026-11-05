export type Framework = 'RIBA' | 'CWA' | 'CUSTOM'
export type ItemKind = 'DRAWING' | 'REPORT' | 'EXIT_CRITERION' | 'APPROVAL' | 'ACCOR' | 'DELIVERABLE'
export type StageStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'PASSED' | 'CONDITIONAL' | 'HOLD'
export type ItemStatus = 'OPEN' | 'DONE' | 'NOT_APPLICABLE'
export type GateDecision = 'PASS' | 'CONDITIONAL_PASS' | 'HOLD'

export type FrameworkItemTemplate = { kind: ItemKind; title: string; responsibleParty?: string }
export type FrameworkStageTemplate = {
  code: string; name: string; outcome?: string; purpose?: string; designFreeze?: boolean
  items: FrameworkItemTemplate[]
}
