'use client'

/**
 * Data-protection actions on a person's profile:
 *  - Download data: the person themselves, or HR on their behalf (subject access request).
 *  - Anonymise: admin/owner, deactivated people only. Irreversible, so it needs the person's name typed in.
 */
import { useState } from 'react'
import { Download, Loader2, ShieldAlert, X } from 'lucide-react'
import { useToast } from '@/components/Toast'

export interface PrivacyInfo {
  canExport: boolean
  /** Admin or owner looking at a deactivated person who is not themselves and not an owner. */
  canAnonymise: boolean
  /** Only the owner may anonymise before the retention period ends (an erasure request). */
  canErase: boolean
  anonymised: boolean
  retentionDays: number
  /** ISO date the retention period ends, or null if the person is not deactivated. */
  retentionEndsAt: string | null
}

export function PrivacyActions({ profileId, fullName, isSelf, privacy, onChanged }: {
  profileId: string
  fullName: string
  isSelf: boolean
  privacy: PrivacyInfo
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const due = privacy.retentionEndsAt ? new Date(privacy.retentionEndsAt).getTime() <= Date.now() : false
  const reason: 'retention' | 'erasure_request' = due ? 'retention' : 'erasure_request'
  const allowed = privacy.canAnonymise && !privacy.anonymised && (due || privacy.canErase)
  const years = Math.round((privacy.retentionDays / 365) * 10) / 10

  async function download() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/staffing/employees/${profileId}/export`, { cache: 'no-store' })
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'Could not prepare the download') }
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url; a.download = `coordin-personal-data-${fullName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast('Data downloaded', 'success')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not prepare the download', 'error')
    } finally { setDownloading(false) }
  }

  async function anonymise() {
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/staffing/employees/${profileId}/anonymise`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason, confirmName: typed }),
      })
      const b = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(b.error || 'Could not anonymise this record')
      toast(b.data?.loginRemoved === false ? 'Record anonymised. The sign-in account could not be removed — remove it in Supabase.' : 'Record anonymised', 'success')
      setOpen(false); setTyped('')
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not anonymise this record')
    } finally { setBusy(false) }
  }

  if (!privacy.canExport && !privacy.canAnonymise) return null

  return (
    <>
      {privacy.canExport && !privacy.anonymised && (
        <button onClick={download} disabled={downloading} title="Everything Coordin holds about this person, as a file"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-50">
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {isSelf ? 'Download my data' : 'Download data'}
        </button>
      )}
      {privacy.canAnonymise && !privacy.anonymised && (
        <button onClick={() => { setOpen(true); setErr(null) }} disabled={!allowed}
          title={allowed ? 'Remove this person’s personal data' : `Available to the owner now, or to admins once the ${years}-year retention period ends`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-[13px] text-red-700 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <ShieldAlert className="w-4 h-4" /> Anonymise
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Anonymise record">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 className="text-[15px] font-semibold text-ink-900">Anonymise {fullName}?</h2>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-ink-50" aria-label="Close"><X className="w-4 h-4 text-ink-400" /></button>
            </div>
            <div className="mt-3 space-y-2 text-[13px] text-ink-600">
              <p><b className="text-red-700">This cannot be undone.</b></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Name, email, phone, emergency contact, pay, benefits and bank details are removed.</li>
                <li>Their sign-in is deleted.</li>
                <li>Projects, tasks, approvals, expenses and the audit trail stay, shown against “Former employee”.</li>
                <li>Uploaded files (HR documents, receipts) are kept — delete those separately if needed.</li>
              </ul>
              <p className="text-ink-500">
                {due
                  ? `The ${years}-year retention period has ended.`
                  : `The retention period has not ended${privacy.retentionEndsAt ? ` (ends ${new Date(privacy.retentionEndsAt).toLocaleDateString()})` : ''}. Only do this now if the person has asked for their data to be erased — it is recorded as an erasure request.`}
              </p>
              <p>Download their data first if you need a copy.</p>
            </div>
            <label className="mt-4 block text-[12px] font-medium text-ink-700">
              Type <span className="font-semibold">{fullName}</span> to confirm
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off"
                className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-[13px]" />
            </label>
            {err && <div role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{err}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-ink-200 text-[13px] text-ink-600 hover:bg-ink-50">Cancel</button>
              <button onClick={anonymise} disabled={busy || typed.trim() !== fullName.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-[13px] font-medium hover:bg-red-700 disabled:opacity-40">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Anonymise permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
