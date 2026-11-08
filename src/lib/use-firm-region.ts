'use client'
import { useEffect, useState } from 'react'

export interface FirmRegion { country: 'EE' | 'GB' | 'NG' | null; currency: 'EUR' | 'GBP' | 'NGN' | 'USD'; vatRate: number | null; timezone: string | null; jurisdiction: 'EE' | 'GB' | null }

/** The firm's country defaults (currency, VAT, time zone). null until loaded. */
export function useFirmRegion(): FirmRegion | null {
  const [r, setR] = useState<FirmRegion | null>(null)
  useEffect(() => {
    let alive = true
    fetch('/api/org/region', { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).then((b) => { if (alive && b?.data) setR(b.data) }).catch(() => {})
    return () => { alive = false }
  }, [])
  return r
}
