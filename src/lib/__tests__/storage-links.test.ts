import { describe, it, expect } from 'vitest'
import { fileLink, parseFileLink, canOpenFile, fileScope } from '../storage-links'

const hr = (role: string) => role === 'HR' || role === 'ADMIN' || role === 'OWNER'
const me = { id: 'p1', organisationId: 'org1', orgPermission: 'MEMBER' }

describe('file links — stable app link, 1-hour signed URL on open', () => {
  it('round-trips bucket and path', () => {
    const link = fileLink('documents', 'org1/proj1/123-plan v2.pdf')
    expect(link.startsWith('/api/files?b=documents&p=')).toBe(true)
    expect(parseFileLink(link)).toEqual({ bucket: 'documents', path: 'org1/proj1/123-plan v2.pdf' })
  })
  it('reads legacy 365-day Supabase links so old rows can be converted', () => {
    expect(parseFileLink('https://x.supabase.co/storage/v1/object/sign/receipts/org1/p1/1-r.pdf?token=abc')).toEqual({ bucket: 'receipts', path: 'org1/p1/1-r.pdf' })
    expect(parseFileLink('https://example.com/a.pdf')).toBeNull()
    expect(parseFileLink('/api/files?b=secrets&p=x')).toBeNull()
  })
  it('only people in the same organisation can open project files and receipts', () => {
    expect(canOpenFile(me, 'documents', 'org1/proj1/a.pdf', hr)).toBe(true)
    expect(canOpenFile(me, 'receipts', 'org1/p9/r.pdf', hr)).toBe(true)
    expect(canOpenFile(me, 'documents', 'org2/proj1/a.pdf', hr)).toBe(false)
  })
  it('HR documents: HR/admins, or the person themselves', () => {
    expect(canOpenFile(me, 'documents', 'hr/org1/p1/contract.pdf', hr)).toBe(true)
    expect(canOpenFile(me, 'documents', 'hr/org1/p2/contract.pdf', hr)).toBe(false)
    expect(canOpenFile({ ...me, orgPermission: 'HR' }, 'documents', 'hr/org1/p2/contract.pdf', hr)).toBe(true)
    expect(canOpenFile({ ...me, orgPermission: 'HR' }, 'documents', 'hr/org2/p2/contract.pdf', hr)).toBe(false)
  })
  it('refuses path tricks', () => {
    expect(canOpenFile(me, 'documents', 'org1/../org2/a.pdf', hr)).toBe(false)
    expect(canOpenFile(me, 'documents', '/org1/a.pdf', hr)).toBe(false)
    expect(canOpenFile(me, 'documents', '', hr)).toBe(false)
    // encoded traversal: storage URLs are not re-encoded, so %2e%2e would collapse to .. at the storage server
    for (const p of ['org1/%2e%2e/org2/a.pdf', 'org1/%252e%252e/org2/a.pdf', 'org1/.%2E/org2/a.pdf', 'org1%2F..%2Forg2/a.pdf', 'org1/./a.pdf', 'org1//a.pdf', 'org1\\..\\org2/a.pdf', 'org1/../../receipts/x'])
      expect(canOpenFile(me, 'documents', p, hr), p).toBe(false)
    expect(canOpenFile(me, 'documents', 'org1/%252e%252e/hr/org1/p2/contract.pdf', hr)).toBe(false)
  })
  it('scopes project documents and receipts for the database check', () => {
    expect(fileScope('documents', 'org1/proj1/123-a.pdf')).toEqual({ kind: 'project', projectId: 'proj1' })
    expect(fileScope('documents', 'org1/proj1/setup/123-a.pdf')).toEqual({ kind: 'project', projectId: 'proj1' })
    expect(fileScope('receipts', 'org1/p1/1-r.pdf')).toEqual({ kind: 'receipt', ownerId: 'p1' })
    expect(fileScope('documents', 'hr/org1/p1/c.pdf')).toEqual({ kind: 'none' })
  })
})
