/**
 * Electronic signature provider seam (Ayo 1.5; e-sign review of DocuSign / Adobe Acrobat Sign).
 *
 * Interface only — no provider is connected yet. Onboarding documents move
 * ASSIGNED → VIEWED → AWAITING_SIGNATURE → COMPLETED; when a provider is chosen it implements this
 * interface and its webhook calls `applySignatureEvent`. Until then HR records signatures manually.
 *
 * Shortlist (Nov 2026 research, to be confirmed with CWA): BoldSign (embedded signing, webhooks,
 * EU data residency, lowest cost), DocuSign (Enhanced plan needed for embedded signing),
 * Adobe Acrobat Sign (M365/SharePoint fit; API pricing by quote).
 */

export type SignatureStatus = 'SENT' | 'VIEWED' | 'SIGNED' | 'DECLINED' | 'EXPIRED' | 'VOIDED'

export interface SignatureRequest {
  /** Coordin onboarding task the document belongs to */
  taskId: string
  documentName: string
  /** Version label recorded on the audit trail (Ayo: record document version) */
  documentVersion: string
  /** File bytes or a URL the provider can fetch */
  file: { url: string } | { bytes: Uint8Array; mimeType: string }
  signer: { name: string; email: string }
  /** Where the signer returns after an embedded signing session */
  returnUrl?: string
}

export interface SignatureEnvelope {
  provider: string
  envelopeId: string
  status: SignatureStatus
  /** Embedded signing URL when the provider supports it, else null (signer is emailed) */
  signingUrl: string | null
}

export interface SignatureEvent {
  provider: string
  envelopeId: string
  status: SignatureStatus
  occurredAt: Date
  /** Provider's audit certificate / completed document, when signed */
  evidenceUrl?: string
}

export interface ESignProvider {
  readonly name: string
  send(req: SignatureRequest): Promise<SignatureEnvelope>
  status(envelopeId: string): Promise<SignatureStatus>
  void(envelopeId: string, reason: string): Promise<void>
  /** Verify and parse an inbound webhook; returns null when the signature check fails */
  parseWebhook(headers: Headers, rawBody: string): Promise<SignatureEvent | null>
}

/** Map a provider status onto the onboarding document status (Ayo's five-status model). */
export function documentStatusFor(status: SignatureStatus): 'AWAITING_SIGNATURE' | 'VIEWED' | 'COMPLETED' | 'ASSIGNED' {
  switch (status) {
    case 'SIGNED': return 'COMPLETED'
    case 'VIEWED': return 'VIEWED'
    case 'SENT': return 'AWAITING_SIGNATURE'
    default: return 'ASSIGNED' // declined / expired / voided → back with HR to reissue
  }
}

/** No provider configured: callers fall back to manual recording. */
export function getESignProvider(): ESignProvider | null {
  return null
}
