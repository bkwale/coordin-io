#!/usr/bin/env node
// Sprint 0.1 — hand-run practice-profile extraction against Mistral.
// Usage: node scripts/sprint0-practice-profile.mjs https://salto.ee [--pages /about/,/people]
// Writes private/ai-samples/practice/<host>.mistral.json

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const url = process.argv[2]
if (!url) { console.error('url required'); process.exit(1) }
const extra = (process.argv.find(a => a.startsWith('--pages=')) || '').replace('--pages=', '')
const pages = ['/', ...(extra ? extra.split(',') : ['/about', '/about/', '/meist', '/people', '/team', '/kontakt', '/contact'])]

const env = Object.fromEntries(readFileSync(resolve('.env.sprint0'), 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')] }))
const KEY = env.MISTRAL_API_KEY
const MODEL = process.env.MODEL || 'mistral-large-latest'

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim()
}

const base = new URL(url)
const crawled = []
for (const p of pages) {
  const u = new URL(p, base).toString()
  try {
    const r = await fetch(u, { headers: { 'user-agent': 'CoordinSprint0/0.1' }, redirect: 'follow' })
    if (!r.ok) continue
    const text = strip(await r.text()).slice(0, 12000)
    if (text.length > 200 && !crawled.some(c => c.text === text)) crawled.push({ url: u, text })
  } catch { /* skip */ }
}
if (!crawled.length) { console.error('nothing crawled'); process.exit(2) }

const system = readFileSync(resolve('private/ai-samples/practice/_prompt-v0.1.md'), 'utf8').split('User:')[0]
const user = `Website: ${url}\nPages crawled: ${crawled.map(c => c.url).join(', ')}\n\n` + crawled.map(c => `--- ${c.url} ---\n${c.text}`).join('\n\n')

const t0 = Date.now()
const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
  method: 'POST',
  headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
  body: JSON.stringify({ model: MODEL, temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
})
const ms = Date.now() - t0
if (!res.ok) { console.error(res.status, await res.text()); process.exit(3) }
const data = await res.json()
let out
try { out = JSON.parse(data.choices[0].message.content) } catch { out = { _raw: data.choices[0].message.content } }
out._meta = { url, pages: crawled.map(c => c.url), model: MODEL, promptVersion: '0.1', runAt: new Date().toISOString(), latencyMs: ms, usage: data.usage }

mkdirSync('private/ai-samples/practice', { recursive: true })
const file = `private/ai-samples/practice/${base.hostname.replace(/^www\./, '')}.mistral.json`
writeFileSync(file, JSON.stringify(out, null, 2))
console.log(`${file}  ${ms}ms  tokens=${data.usage?.total_tokens}`)
