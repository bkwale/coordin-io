import { describe, it, expect } from 'vitest'
import { fileLink, parseFileLink, canOpenFile } from '../storage-links'

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
  })
})
