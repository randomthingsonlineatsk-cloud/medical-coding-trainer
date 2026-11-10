// What coding hands on: the coded variables of the SDTM AE, MH and CM datasets, and the coding
// report for the trial master file. Variable names follow SDTMIG (AELLT, AEDECOD, AEBODSYS...);
// the dictionary names and versions go in the define file and the reviewer's guide.
import { path, secondarySocs } from './dictmed'
import { atcPath } from './dictdrug'
import { drugRec, smdOf, stats, consistency, sddName, type CodingProject } from './coding'

const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
export function medCsv(p: CodingProject, form: 'AE' | 'MH'): string {
  const P = form
  const head = ['STUDYID', 'USUBJID', `${P}TERM`, `${P}LLT`, `${P}LLTCD`, `${P}DECOD`, `${P}PTCD`, `${P}HLT`, `${P}HLTCD`, `${P}HLGT`, `${P}HLGTCD`, `${P}BODSYS`, `${P}BDSYCD`, `${P}SOC`, `${P}SOCCD`, 'SECONDARY_SOCS', 'CODING_STATUS', 'DICTIONARY']
  const d = smdOf(p)
  const rows = p.records.filter((r) => r.form === form && !['replaced', 'removed'].includes(r.status)).map((r) => {
    const pth = r.code ? path(d, r.code) : []
    const [soc, hlgt, hlt, pt, llt] = pth
    const sec = pt ? secondarySocs(d, pt.code).map((x) => x.name).join('; ') : ''
    return [r.study, `${r.study}-${r.subj}`, r.verbatim, llt?.name, llt?.code, pt?.name, pt?.code, hlt?.name, hlt?.code, hlgt?.name, hlgt?.code, soc?.name, soc?.code, soc?.name, soc?.code, sec, r.status, `SMD ${p.smd} (training)`]
  })
  return [head.map(q).join(','), ...rows.map((r) => r.map(q).join(','))].join('\r\n')
}
export function cmCsv(p: CodingProject): string {
  const head = ['STUDYID', 'USUBJID', 'CMTRT', 'CMINDC', 'CMDECOD', 'DRUG_RECORD', 'CMCLAS', 'CMCLASCD', 'CODING_STATUS', 'DICTIONARY']
  const rows = p.records.filter((r) => r.form === 'CM' && !['replaced', 'removed'].includes(r.status)).map((r) => {
    const dr = drugRec(p.sdd, r.code)
    const cls = r.atc ? atcPath(r.atc).at(-1) : undefined
    const decod = dr ? dr.ingredients.map((x) => x.toUpperCase()).join(' + ') : ''
    return [r.study, `${r.study}-${r.subj}`, r.verbatim, r.ind, decod, dr?.id, cls?.name, cls?.code, r.status, `${sddName(p.sdd)}`]
  })
  return [head.map(q).join(','), ...rows.map((r) => r.map(q).join(','))].join('\r\n')
}
const h = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
export function codingReport(p: CodingProject): string {
  const s = stats(p), c = consistency(p)
  const queries = p.records.filter((r) => r.query).map((r) => `<tr><td>${h(r.id)}</td><td>${h(r.study)}</td><td>${h(r.trail[0]?.what.replace('Verbatim received: ', ''))}</td><td>${h(r.query!.text)}</td><td>${h(r.query!.answer ?? 'open')}</td></tr>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Coding report</title><style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;color:#1d2433;background:#fff}table{border-collapse:collapse;width:100%}td,th{border:1px solid #c8ccd4;padding:.3rem .45rem;font-size:.85rem;text-align:left}th{background:#eef0f4}.n{background:#fff7e0;border:1px solid #e8c770;padding:.5rem}</style></head><body>
<p class="n">Training material: fictional studies and training dictionaries shaped like MedDRA and WHODrug. Not for real use.</p>
<h1>Coding report: ${h(p.name)}</h1><p>Studies ${h(p.studies.join(', '))}. Dictionaries: SMD ${h(p.smd)} (medical), ${h(sddName(p.sdd))} (drugs).</p>
<table><tr><th>Records</th><th>Approved</th><th>Coded, not yet approved</th><th>Uncoded</th><th>Open queries</th><th>Autoencoded</th><th>By synonym</th><th>Manual</th><th>Inconsistent verbatims</th></tr><tr><td>${s.total}</td><td>${s.approved}</td><td>${s.coded - s.approved}</td><td>${s.uncoded}</td><td>${s.queries}</td><td>${s.auto}</td><td>${s.synonym}</td><td>${s.manual}</td><td>${c.length}</td></tr></table>
<h2>Coding queries</h2><table><tr><th>Record</th><th>Study</th><th>Original verbatim</th><th>Query</th><th>Answer</th></tr>${queries || '<tr><td colspan="5">None</td></tr>'}</table>
<h2>Dictionary upgrades</h2><ul>${p.upgrades.map((u) => `<li>${h(u.from)} to ${h(u.to)}, ${h(u.utc.slice(0, 10))}, signed by ${h(u.signed.name)}: ${h(u.note)}</li>`).join('') || '<li>None</li>'}</ul>
<h2>Synonym list changes in this project</h2><ul>${p.synonyms.filter((x) => x.scope !== 'company' || x.status === 'retired').map((x) => `<li>"${h(x.verbatim)}" (${h(x.scope)}): ${h(x.status)}${x.note ? `, ${h(x.note)}` : ''}</li>`).join('') || '<li>None</li>'}</ul>
</body></html>`
}
