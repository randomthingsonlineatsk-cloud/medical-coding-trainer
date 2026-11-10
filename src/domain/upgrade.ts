// Upversioning: moving a study's coding to a new dictionary version. Both dictionaries release
// twice a year. The data management plan says when a study upgrades; before applying, the team
// reviews what the new version changes in the study's coding, then recodes and re-reviews.
import { SMD, ptOf, path, V11_CHANGES } from './dictmed'
import { SDD_Q3_CHANGES, atcByCode } from './dictdrug'
import { drugRec, exactDrugIn, me, needRole, log, label, type CodingProject, type Rec, type Signature, type SmdV, type SddV } from './coding'

export type ImpactKind = 'recode' | 'pt-changed' | 'soc-moved' | 'class-changed' | 'name-changed'
export const IMPACT_LABEL: Record<ImpactKind, string> = {
  recode: 'Recode: the LLT is retired', 'pt-changed': 'Review: the preferred term changes', 'soc-moved': 'Review: the system class changes',
  'class-changed': 'Review: the drug class changes', 'name-changed': 'Review: the trade name now means another product',
}
export interface ImpactRow { id: string; verbatim: string; kind: ImpactKind; from: string; to: string }
export function impact(p: CodingProject, smd: SmdV = '1.1', sdd: SddV = 'Q3') {
  const rows: ImpactRow[] = []
  const a = SMD[p.smd], b = SMD[smd]
  for (const r of p.records.filter((x) => ['coded', 'approved'].includes(x.status) && x.code)) {
    if (r.form !== 'CM') {
      if (smd === p.smd) continue
      const t = b.terms.get(r.code!)
      if (!t || !t.current) { rows.push({ id: r.id, verbatim: r.verbatim, kind: 'recode', from: label(p, r), to: 'choose a current LLT' }); continue }
      const pa = ptOf(a, r.code!), pb = ptOf(b, r.code!)
      if (pa?.name !== pb?.name) rows.push({ id: r.id, verbatim: r.verbatim, kind: 'pt-changed', from: pa?.name ?? '', to: pb?.name ?? '' })
      else if (path(a, r.code!)[0]?.name !== path(b, r.code!)[0]?.name) rows.push({ id: r.id, verbatim: r.verbatim, kind: 'soc-moved', from: path(a, r.code!)[0]?.name ?? '', to: path(b, r.code!)[0]?.name ?? '' })
    } else {
      if (sdd === p.sdd) continue
      const d = drugRec(p.sdd, r.code)
      if (!d) continue
      const nd = exactDrugIn(sdd, d.name)
      if (nd && nd.ingredients.join('+') !== d.ingredients.join('+')) { rows.push({ id: r.id, verbatim: r.verbatim, kind: 'name-changed', from: `${d.name} = ${d.ingredients.join(' + ')}`, to: `${nd.name} = ${nd.ingredients.join(' + ')}` }); continue }
      const after = SDD_Q3_CHANGES.find((c) => c.kind === 'reclass' && c.ingredient === d.ingredients.join('+')) as { from: string; to: string } | undefined
      if (after && r.atc === after.from) rows.push({ id: r.id, verbatim: r.verbatim, kind: 'class-changed', from: `${after.from} ${atcByCode.get(after.from)?.name}`, to: `${after.to} ${atcByCode.get(after.to)?.name}` })
    }
  }
  const synonyms = p.synonyms.filter((s) => s.status !== 'retired' && s.dict === 'SMD' && smd !== p.smd && !b.terms.get(s.code)?.current)
  return { rows, synonyms, changes: { smd: smd !== p.smd ? V11_CHANGES : [], sdd: sdd !== p.sdd ? SDD_Q3_CHANGES : [] } }
}

export function applyUpgrade(p: CodingProject, s: Omit<Signature, 'utc'>, note: string, smd: SmdV = '1.1', sdd: SddV = 'Q3') {
  needRole(p, 'lead', 'Applying a dictionary upgrade')
  if (s.name.trim().toLowerCase() !== me(p).name.toLowerCase()) throw new Error(`Sign with your own name (${me(p).name}).`)
  if (!p.reviewedImpact) throw new Error('Review the impact report first.')
  if (note.trim().length < 20) throw new Error('Write the upgrade note: the versions, why now, and what the impact review found.')
  const im = impact(p, smd, sdd)
  const from = `SMD ${p.smd} / SDD ${p.sdd}`
  for (const row of im.rows) {
    const r = p.records.find((x) => x.id === row.id)!
    if (row.kind === 'recode') { Object.assign(r, { status: 'uncoded', reviewedBy: undefined }); flag(r, 'Recode: LLT retired in the new version') }
    else if (row.kind === 'name-changed') { Object.assign(r, { status: 'coded', reviewedBy: undefined }); flag(r, `Review after upgrade: ${row.to}`) }
    else if (row.kind === 'class-changed') { const to = row.to.split(' ')[0]; r.atc = to; Object.assign(r, { status: 'coded', reviewedBy: undefined }); flag(r, `Review after upgrade: class now ${to}`) }
    else { Object.assign(r, { status: 'coded', reviewedBy: undefined }); flag(r, `Review after upgrade: ${row.from} → ${row.to}`) }
    r.trail.push({ utc: new Date().toISOString(), by: me(p).name, what: `Upgrade to SMD ${smd} / SDD ${sdd}: ${row.kind}` })
  }
  for (const syn of im.synonyms) syn.note = `Points to a retired term after the upgrade to ${smd}: update or retire it.`
  p.smd = smd; p.sdd = sdd; p.reviewedImpact = false
  p.upgrades.push({ from, to: `SMD ${smd} / SDD ${sdd}`, utc: new Date().toISOString(), signed: { ...s, utc: new Date().toISOString() }, note: note.trim() })
  log(p, `Dictionaries upgraded from ${from} to SMD ${smd} / SDD ${sdd}: ${im.rows.length} records affected`)
  return im
}
const flag = (r: Rec, f: string) => { r.flags = [...new Set([...(r.flags ?? []), f])] }
// After the upgrade: synonyms still pointing at retired terms.
export const staleSynonyms = (p: CodingProject) => p.synonyms.filter((s) => s.status !== 'retired' && s.dict === 'SMD' && !SMD[p.smd].terms.get(s.code)?.current)
