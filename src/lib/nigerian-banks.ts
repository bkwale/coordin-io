/**
 * Nigerian bank codes — used for Paystack bank verification
 * and the bank dropdown in employee profiles.
 *
 * Source: Paystack supported banks list
 * Last updated: 2026-10
 */

export interface NigerianBank {
  name: string
  code: string
  /** NUBAN = Nigerian Uniform Bank Account Number (10-digit) */
  type: string
}

export const NIGERIAN_BANKS: NigerianBank[] = [
  { name: 'Access Bank', code: '044', type: 'nuban' },
  { name: 'Access Bank (Diamond)', code: '063', type: 'nuban' },
  { name: 'Carbon (OneFi)', code: '565', type: 'nuban' },
  { name: 'Citibank Nigeria', code: '023', type: 'nuban' },
  { name: 'Ecobank Nigeria', code: '050', type: 'nuban' },
  { name: 'Fidelity Bank', code: '070', type: 'nuban' },
  { name: 'First Bank of Nigeria', code: '011', type: 'nuban' },
  { name: 'First City Monument Bank', code: '214', type: 'nuban' },
  { name: 'Globus Bank', code: '00103', type: 'nuban' },
  { name: 'Guaranty Trust Bank', code: '058', type: 'nuban' },
  { name: 'Heritage Bank', code: '030', type: 'nuban' },
  { name: 'Jaiz Bank', code: '301', type: 'nuban' },
  { name: 'Keystone Bank', code: '082', type: 'nuban' },
  { name: 'Kuda Bank', code: '50211', type: 'nuban' },
  { name: 'Lotus Bank', code: '303', type: 'nuban' },
  { name: 'Moniepoint MFB', code: '50515', type: 'nuban' },
  { name: 'Opay', code: '999992', type: 'nuban' },
  { name: 'Optimus Bank', code: '107', type: 'nuban' },
  { name: 'PalmPay', code: '999991', type: 'nuban' },
  { name: 'Parallex Bank', code: '104', type: 'nuban' },
  { name: 'Polaris Bank', code: '076', type: 'nuban' },
  { name: 'Premiumtrust Bank', code: '105', type: 'nuban' },
  { name: 'Providus Bank', code: '101', type: 'nuban' },
  { name: 'Stanbic IBTC Bank', code: '221', type: 'nuban' },
  { name: 'Standard Chartered Bank', code: '068', type: 'nuban' },
  { name: 'Sterling Bank', code: '232', type: 'nuban' },
  { name: 'SunTrust Bank', code: '100', type: 'nuban' },
  { name: 'TAJ Bank', code: '302', type: 'nuban' },
  { name: 'Titan Trust Bank', code: '102', type: 'nuban' },
  { name: 'Union Bank of Nigeria', code: '032', type: 'nuban' },
  { name: 'United Bank for Africa', code: '033', type: 'nuban' },
  { name: 'Unity Bank', code: '215', type: 'nuban' },
  { name: 'VFD Microfinance Bank', code: '566', type: 'nuban' },
  { name: 'Wema Bank', code: '035', type: 'nuban' },
  { name: 'Zenith Bank', code: '057', type: 'nuban' },
].sort((a, b) => a.name.localeCompare(b.name))

/** Look up bank by code */
export function getBankByCode(code: string): NigerianBank | undefined {
  return NIGERIAN_BANKS.find((b) => b.code === code)
}

/** Look up bank by name (case-insensitive partial match) */
export function findBankByName(query: string): NigerianBank[] {
  const q = query.toLowerCase()
  return NIGERIAN_BANKS.filter((b) => b.name.toLowerCase().includes(q))
}
