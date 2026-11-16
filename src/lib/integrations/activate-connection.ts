/**
 * Which row should hold a newly authorised connection.
 *
 * A firm can have only one row per outside account (a database rule). If the firm connected this account before
 * and then disconnected, that old row still exists, so the new sign-in must go back into it. Writing the account
 * id onto the temporary "pending" row instead breaks the rule and the connection fails: that is what made
 * "Disconnect, then Connect again" impossible until November 2026.
 */
export type ActivationPlan = { reuse: true; targetId: string; deletePendingId: string } | { reuse: false; targetId: string; deletePendingId: null }

export function planActivation(pendingId: string, existingIdForSameAccount: string | null | undefined): ActivationPlan {
  if (existingIdForSameAccount && existingIdForSameAccount !== pendingId) return { reuse: true, targetId: existingIdForSameAccount, deletePendingId: pendingId }
  return { reuse: false, targetId: pendingId, deletePendingId: null }
}
