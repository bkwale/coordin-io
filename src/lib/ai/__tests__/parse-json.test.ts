import { describe, it, expect } from 'vitest'
import { parseJson, repairTruncatedJson } from '@/lib/ai/providers'

describe('parseJson', () => {
  it('parses clean, fenced, and prose-wrapped JSON', () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 })
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJson('Here you go:\n{"a":{"b":[1,2]}}\nThanks')).toEqual({ a: { b: [1, 2] } })
  })
  it('repairs output truncated mid-array (max_tokens)', () => {
    const cut = '{"document":{"number":"1"},"conditions":[{"topic":"a","text":"x"},{"topic":"b","text":"long tex'
    const out = parseJson(cut) as any
    expect(out.document.number).toBe('1')
    expect(out.conditions).toHaveLength(1)
  })
  it('repairs output truncated mid-object key', () => {
    const cut = '{"a":{"b":1,"c":[1,2,3]},"d":{"e":"ok","f'
    const out = parseJson(cut) as any
    expect(out.a).toEqual({ b: 1, c: [1, 2, 3] })
    expect(out.d).toEqual({ e: 'ok' })
  })
  it('repairs a trailing comma and unclosed brackets', () => {
    expect(repairTruncatedJson('{"a":[1,2,')).toEqual({ a: [1, 2] })
  })
  it('throws when nothing can be salvaged', () => {
    expect(() => parseJson('no json here')).toThrow(/No JSON/)
  })
})
