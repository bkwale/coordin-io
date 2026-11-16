import { describe, it, expect } from 'vitest'
import { taskDraft, tasksMade, parseRunInput } from '../summary-tasks'

const action = { text: 'Leida tuleohutuse ekspert ja tellida CLT-lahenduse hinnang', owner: 'Liis Kask', due: '10.11.2026', page: 2, quote: 'Leida tuleohutuse ekspert', verified: true }

describe('task text made from a summary action', () => {
  it('says what to do and exactly where the document says it', () => {
    const d = taskDraft(action, 'Protokoll nr 4')
    expect(d.title).toBe(action.text)
    expect(d.description).toContain('From the document "Protokoll nr 4", page 2.')
    expect(d.description).toContain('Document wording: "Leida tuleohutuse ekspert"')
    expect(d.description).toContain('Named in the document: Liis Kask')
    expect(d.description).toContain('Deadline in the document: 10.11.2026')
    expect(d.description).toContain('confirmed by a person')
  })
  it('leaves out what the document did not say, and warns when the wording was not matched', () => {
    const d = taskDraft({ ...action, owner: null, due: null, page: null, quote: null, verified: false }, 'Spec')
    expect(d.description).not.toContain('Named in the document')
    expect(d.description).not.toContain('Deadline in the document')
    expect(d.description).not.toContain('page')
    expect(d.description).toContain('could not be matched to the document')
  })
  it('keeps within the task field limits', () => {
    const d = taskDraft({ ...action, text: 'x'.repeat(900), quote: 'q'.repeat(400) }, 't'.repeat(300))
    expect(d.title).toHaveLength(500)
    expect(d.description.length).toBeLessThanOrEqual(5000)
  })
})

describe('what a run remembers', () => {
  it('tasks already made: index → task id, ignoring anything else stored there', () => {
    expect(tasksMade({ tasks: { '0': 'task_a', '3': 'task_b', '4': 7 }, other: 1 })).toEqual({ '0': 'task_a', '3': 'task_b' })
    expect(tasksMade(null)).toEqual({})
    expect(tasksMade({ tasks: 'nope' })).toEqual({})
  })
  it('run input parses, and broken input is empty rather than a crash', () => {
    expect(parseRunInput('{"kind":"summary","documentId":"d1","title":"T","pages":4}')).toMatchObject({ documentId: 'd1', title: 'T', pages: 4 })
    expect(parseRunInput('not json')).toEqual({})
    expect(parseRunInput('null')).toEqual({})
  })
})
