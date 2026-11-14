// The coding engine: a project holds the verbatim records of one or more studies, the synonym
// lists, the dictionary versions in force and the team. Records move uncoded -> coded (by the
// autoencoder, a synonym or a coder) or query -> approved (by a reviewer who did not code them).
import { SMD, path, ptOf, exactLlt, exactLltAny, LANG_NAME, type MedDict, type Term, type Lang } from './dictmed'
import { drugsIn, SDD_VERSION, SDD_Q3_VERSION, atcByCode, type DrugRecord } from './dictdrug'
import { CATALOGUE, STUDIES, INDICATIONS, itemFor, answerIn, norm, type Form, type Item, type Answer } from './catalogue'
import { rng, hash } from './util'

export type SmdV = '1.0' | '1.1'
export type SddV = 'Q1' | 'Q3'
export type Role = 'coder' | 'reviewer' | 'lead'
export const ROLE_LABEL: Record<Role, string> = { coder: 'Coder', reviewer: 'Coding reviewer', lead: 'Coding lead' }
export interface Member { name: string; role: Role }
export const DEFAULT_TEAM: Member[] = [{ name: 'Anika Rao', role: 'coder' }, { name: 'Tom Hale', role: 'reviewer' }, { name: 'Grace Mwangi', role: 'lead' }]
export type Status = 'uncoded' | 'coded' | 'query' | 'approved' | 'replaced' | 'removed'
export interface Rec {
  id: string; study: string; subj: string; form: Form; verbatim: string; ind?: string; itemId?: string
  status: Status; code?: string; atc?: string; method?: 'auto' | 'synonym' | 'manual' | 'assistant'; by?: string; utc?: string
  indCode?: string; indMethod?: 'auto' | 'synonym' | 'manual' | 'assistant'; indBy?: string   // the indication, coded with the medical dictionary (CC-28)
  lang?: Lang; translation?: string                                                            // a verbatim in another language and its recorded translation (CC-12)
  suggestion?: { code?: string; atc?: string; query?: 'split' | 'clarify' | 'not-drug'; conf: number; why: string; decision?: 'accepted' | 'rejected'; reason?: string; by?: string; verbatim?: string; ind?: string }
  reviewedBy?: string; query?: { kind: 'split' | 'clarify' | 'not-drug' | 'indication'; text: string; by: string; utc: string; answer?: string }
  queried?: boolean; indQueried?: boolean; flags?: string[]; comment?: string; parent?: string; trail: { utc: string; by: string; what: string }[]
}
export interface Synonym { id: string; scope: 'company' | string; dict: 'SMD' | 'SDD'; verbatim: string; code: string; atc?: string; status: 'approved' | 'proposed' | 'retired'; by: string; approvedBy?: string; note?: string; utc: string }
export interface Signature { name: string; role: string; meaning: string; utc: string }
export interface CodingProject {
  schema: 1; id: string; name: string; created: string; updated: string
  studies: string[]; forms: Form[]; records: Rec[]; synonyms: Synonym[]
  smd: SmdV; sdd: SddV; upgrades: { from: string; to: string; utc: string; signed: Signature; note: string }[]
  team: Member[]; as: number; history: { utc: string; by: string; what: string }[]
  mission?: { id: string; level: 'guided' | 'standard' | 'expert'; startedUtc: string; endedUtc?: string; score?: number; detail?: string[] }
  reviewedImpact?: boolean
  assistant?: boolean                       // the AI coding assistant is switched on
  answers?: Record<string, string>          // answers to mission questions (data retrieval)
  customQueries?: { id: string; name: string; pts: string[]; by: string }[]
  source?: string                           // where the records came from (e.g. a CDM console export)
}

const now = () => new Date().toISOString()
export const me = (p: CodingProject) => p.team[p.as] ?? p.team[0]
export function needRole(p: CodingProject, role: Role | Role[], what: string) {
  const rs = Array.isArray(role) ? role : [role]
  if (!rs.includes(me(p).role)) throw new Error(`${what} is for the ${rs.map((r) => ROLE_LABEL[r].toLowerCase()).join(' or ')}. You are working as ${me(p).name} (${ROLE_LABEL[me(p).role].toLowerCase()}): switch roles in the header.`)
}
export const log = (p: CodingProject, what: string) => { p.history.push({ utc: now(), by: me(p).name, what }); p.updated = now() }
const trail = (p: CodingProject, r: Rec, what: string, by = me(p).name) => r.trail.push({ utc: now(), by, what })

export const smdOf = (p: CodingProject): MedDict => SMD[p.smd]
export const sddList = (p: CodingProject) => drugsIn(p.sdd)
export const sddName = (v: SddV) => (v === 'Q1' ? SDD_VERSION : SDD_Q3_VERSION)
const drugIndex = { Q1: new Map(drugsIn('Q1').map((d) => [d.id, d])), Q3: new Map(drugsIn('Q3').map((d) => [d.id, d])) }
export const drugRec = (v: SddV, id?: string): DrugRecord | undefined => (id ? drugIndex[v].get(id) ?? drugIndex.Q1.get(id) : undefined)
export const exactDrugIn = (v: SddV, verbatim: string) => drugsIn(v).find((d) => norm(d.name) === norm(verbatim))

// ---------- the company synonym list (with some entries that should not be there) ----------
const L = (name: string) => [...SMD['1.0'].terms.values()].find((t) => t.level === 'LLT' && t.name === name)!.code
const D1 = (name: string) => drugsIn('Q1').find((d) => d.name === name)!.id
export const BAD_SYNONYMS: Record<string, string> = {
  cold: 'Ambiguous: a common cold, or feeling cold. The site must say which (CC-06).',
  pain: 'Vague: pain where? Mapping it to head pain guesses (CC-06).',
  'dizziness on standing': 'Adds a diagnosis the investigator did not make (CC-02).',
  'chest infection': 'Adds a diagnosis: a chest infection is not necessarily pneumonia (CC-02, CC-06).',
  aspirin: 'Fixes the class to analgesic, but aspirin for prevention of heart attack is an antithrombotic: the class depends on the indication (CC-25).',
}
export function companySynonyms(): Synonym[] {
  const s = (verbatim: string, dict: 'SMD' | 'SDD', code: string, atc?: string, note?: string): Synonym => ({ id: `SYN-${hash(dict + verbatim).slice(-6)}`, scope: 'company', dict, verbatim, code, atc, status: 'approved', by: 'Company coding group', approvedBy: 'Company coding group', note, utc: '2025-11-03T09:00:00.000Z' })
  return [
    s('low bp', 'SMD', L('Blood pressure low')), s('hayfever', 'SMD', L('Hay fever')), s('t2dm', 'SMD', L('Type 2 diabetes mellitus')),
    s('high bp', 'SMD', L('High blood pressure')), s('swollen ankle', 'SMD', L('Swollen ankles')), s('omeprazol', 'SDD', D1('Omeprazole')),
    s('dizzy spells', 'SMD', L('Dizzy')),
    s('cold', 'SMD', L('Common cold')), s('pain', 'SMD', L('Headache')), s('dizziness on standing', 'SMD', L('Orthostatic hypotension')),
    s('chest infection', 'SMD', L('Pneumonia')), s('aspirin', 'SDD', D1('Aspirin'), 'K02BA'),
  ].sort((x, y) => x.verbatim.localeCompare(y.verbatim))
}

// ---------- building a project ----------
export function makeRecords(studies: string[], forms: Form[], seed = 7): Rec[] {
  const r = rng(seed), out: Rec[] = []
  let n = 0
  for (const st of STUDIES.filter((s) => studies.includes(s.id))) {
    const subjects = st.sites.flatMap((site) => Array.from({ length: 8 }, (_, i) => `${site}-${String(i + 1).padStart(3, '0')}`))
    // Medical history and events first; a medication usually goes to a participant whose history
    // or events include its indication (about 85%), so the indication cross-check finds real gaps.
    const items = CATALOGUE.filter((x) => x.study === st.id && forms.includes(x.form)).sort((a, b) => Number(a.form === 'CM') - Number(b.form === 'CM'))
    const ptsBy = new Map<string, Set<string>>()
    for (const it of items) for (let i = 0; i < it.n; i++) {
      let subj = r.pick(subjects)
      if (it.form === 'CM' && it.ind) {
        const want = indicationPt(it.ind)
        const fit = subjects.filter((s) => want && ptsBy.get(s)?.has(want))
        if (fit.length && r.chance(0.85)) subj = r.pick(fit)
      } else if ('pt' in it.ans) { const set = ptsBy.get(subj) ?? new Set(); set.add(it.ans.pt); ptsBy.set(subj, set) }
      out.push({ id: `R${String(++n).padStart(4, '0')}`, study: st.id, subj, form: it.form, verbatim: it.v, ind: it.ind, itemId: it.id, status: 'uncoded', trail: [{ utc: '2026-10-01T08:00:00.000Z', by: 'EDC extract', what: `Verbatim received: "${it.v}"` }] })
    }
  }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [out[i], out[j]] = [out[j], out[i]] }
  return out
}
// The LLT (and PT) an indication text codes to, if it codes at all.
export function indicationLlt(ind: string, d: MedDict = SMD['1.0']): Term | undefined {
  const k = INDICATIONS[norm(ind)]
  if (k && 'query' in k) return undefined
  return exactLlt(d, k ? k.llt : ind)
}
export const indicationPt = (ind: string, d: MedDict = SMD['1.0']) => { const t = indicationLlt(ind, d); return t ? ptOf(d, t.code)?.name : undefined }
export function createProject(opts: { name: string; studies: string[]; forms: Form[]; seed?: number; synonyms?: Synonym[] }): CodingProject {
  const t = now()
  return { schema: 1, id: `MC-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: opts.name, created: t, updated: t, studies: opts.studies, forms: opts.forms,
    records: makeRecords(opts.studies, opts.forms, opts.seed), synonyms: opts.synonyms ?? companySynonyms(), smd: '1.0', sdd: 'Q1', upgrades: [],
    team: DEFAULT_TEAM.map((m) => ({ ...m })), as: 0, history: [{ utc: t, by: 'System', what: 'Project created' }] }
}
export function upgradeProject(p: CodingProject): CodingProject {
  if (!Array.isArray(p.team) || !p.team.length) { p.team = DEFAULT_TEAM.map((m) => ({ ...m })); p.as = 0 }
  if (!p.team[p.as]) p.as = 0
  return p
}

// ---------- the autoencoder ----------
const activeSynonym = (p: CodingProject, r: Rec, dict: 'SMD' | 'SDD') => p.synonyms.find((s) => s.status === 'approved' && s.dict === dict && (s.scope === 'company' || s.scope === r.study) && s.verbatim === norm(r.verbatim))
export function autoencode(p: CodingProject): { auto: number; synonym: number; left: number; needClass: number } {
  needRole(p, ['coder', 'lead'], 'Running the autoencoder')
  let auto = 0, syn = 0, needClass = 0
  const d = smdOf(p)
  for (const r of p.records.filter((x) => x.status === 'uncoded')) {
    if (r.form === 'CM') {
      const s = activeSynonym(p, r, 'SDD')
      const rec = exactDrugIn(p.sdd, r.verbatim) ?? (s ? drugRec(p.sdd, s.code) : undefined)
      if (!rec) continue
      const atc = s?.atc ?? (rec.atc.length === 1 ? rec.atc[0] : undefined)
      if (!atc) { needClass++; r.flags = [...new Set([...(r.flags ?? []), 'Class needed: the record has more than one class'])]; continue }
      Object.assign(r, { status: 'coded', code: rec.id, atc, method: exactDrugIn(p.sdd, r.verbatim) && !s?.atc ? 'auto' : 'synonym', by: 'Autoencoder', utc: now() })
      autoIndication(p, r)
      trail(p, r, `Autoencoded to ${rec.name} (${rec.id}), class ${atc}${s ? ` by synonym "${s.verbatim}"` : ''}`, 'Autoencoder')
      if (r.method === 'auto') auto++; else syn++
      continue
    }
    const hit = exactLltAny(d, r.verbatim)
    const exact = hit?.term
    const s = exact ? undefined : activeSynonym(p, r, 'SMD')
    const t = exact ?? (s ? d.terms.get(s.code) : undefined)
    if (!t || !t.current) continue
    Object.assign(r, { status: 'coded', code: t.code, method: exact ? 'auto' : 'synonym', by: 'Autoencoder', utc: now() })
    if (hit?.lang) { r.lang = hit.lang; r.translation = `${t.name} (${LANG_NAME[hit.lang]} language version)` }
    trail(p, r, `Autoencoded to LLT ${t.name} (${t.code})${hit?.lang ? ` through the ${LANG_NAME[hit.lang]} language version` : ''}${s ? ` by synonym "${s.verbatim}"` : ''}`, 'Autoencoder')
    if (exact) auto++; else syn++
  }
  for (const r of p.records.filter((x) => x.form === 'CM' && x.status === 'coded' && x.ind && !x.indCode)) autoIndication(p, r)
  const left = p.records.filter((x) => x.status === 'uncoded').length
  log(p, `Autoencoder: ${auto} exact, ${syn} by synonym, ${left} left for manual coding`)
  return { auto, synonym: syn, left, needClass }
}

function autoIndication(p: CodingProject, r: Rec) {
  if (!r.ind || r.indCode) return
  const d = smdOf(p)
  const syn = p.synonyms.find((x) => x.status === 'approved' && x.dict === 'SMD' && (x.scope === 'company' || x.scope === r.study) && x.verbatim === norm(r.ind!))
  const exact = exactLlt(d, r.ind)
  const t = exact ?? (syn ? d.terms.get(syn.code) : undefined)
  if (!t || !t.current) return
  r.indCode = t.code; r.indMethod = exact ? 'auto' : 'synonym'; r.indBy = 'Autoencoder'
  trail(p, r, `Indication "${r.ind}" autoencoded to LLT ${t.name}`, 'Autoencoder')
}
export function codeIndication(p: CodingProject, ids: string[], lltCode: string) {
  needRole(p, 'coder', 'Coding')
  const t = smdOf(p).terms.get(lltCode)
  if (!t || t.level !== 'LLT' || !t.current) throw new Error('Choose a current lowest-level term for the indication.')
  for (const id of ids) {
    const r = p.records.find((x) => x.id === id)!
    if (r.form !== 'CM' || !r.ind) continue
    Object.assign(r, { indCode: t.code, indMethod: 'manual', indBy: me(p).name, reviewedBy: undefined, status: r.status === 'approved' ? 'coded' : r.status })
    trail(p, r, `Indication "${r.ind}" coded to LLT ${t.name}`)
  }
  log(p, `Coded the indication of ${ids.length} record(s) to ${t.name}`)
}
export const isForeign = (r: Rec) => !!(r.lang ?? (r.itemId ? CATALOGUE.find((x) => x.id === r.itemId)?.lang : undefined)) || /[^\u0000-\u024f]/.test(r.verbatim)

// ---------- manual coding ----------
export function codeMed(p: CodingProject, ids: string[], lltCode: string, synonym = false, translation = '') {
  needRole(p, 'coder', 'Coding')
  const foreign = ids.map((id) => p.records.find((x) => x.id === id)!).filter(isForeign)
  if (foreign.length && translation.trim().length < 3) throw new Error(`"${foreign[0].verbatim}" is not in English: record your translation before coding it (CC-12).`)
  const t = smdOf(p).terms.get(lltCode)
  if (!t || t.level !== 'LLT') throw new Error('Choose a lowest-level term.')
  if (!t.current) throw new Error(`${t.name} is not current in SMD ${p.smd}: choose a current LLT (CC-01).`)
  for (const id of ids) {
    const r = p.records.find((x) => x.id === id)!
    if (r.form === 'CM') throw new Error('Medications are coded with the drug dictionary.')
    Object.assign(r, { status: 'coded', code: t.code, atc: undefined, method: 'manual', by: me(p).name, utc: now(), reviewedBy: undefined, flags: (r.flags ?? []).filter((f) => !f.startsWith('Recode')) })
    if (isForeign(r)) { r.translation = translation.trim(); r.lang ??= CATALOGUE.find((x) => x.id === r.itemId)?.lang }
    trail(p, r, `Coded to LLT ${t.name} (${t.code})${isForeign(r) ? `; translation recorded: "${translation.trim()}"` : ''}`)
  }
  if (synonym) proposeSynonym(p, p.records.find((x) => x.id === ids[0])!, t.code)
  log(p, `Coded ${ids.length} record(s) to ${t.name}`)
}
export function codeDrug(p: CodingProject, ids: string[], drugId: string, atc: string, synonym = false) {
  needRole(p, 'coder', 'Coding')
  const d = drugRec(p.sdd, drugId)
  if (!d || !drugIndex[p.sdd].has(drugId)) throw new Error(`Choose a drug record in ${sddName(p.sdd)}.`)
  if (!d.atc.includes(atc)) throw new Error(`Class ${atc} is not one of ${d.name}'s classes (${d.atc.join(', ')}).`)
  for (const id of ids) {
    const r = p.records.find((x) => x.id === id)!
    if (r.form !== 'CM') throw new Error('Adverse events and history are coded with the medical dictionary.')
    Object.assign(r, { status: 'coded', code: d.id, atc, method: 'manual', by: me(p).name, utc: now(), reviewedBy: undefined, flags: (r.flags ?? []).filter((f) => !f.startsWith('Class needed') && !f.startsWith('Review')) })
    trail(p, r, `Coded to ${d.name} (${d.id}), class ${atc}`)
    autoIndication(p, r)
  }
  if (synonym) proposeSynonym(p, p.records.find((x) => x.id === ids[0])!, d.id, undefined)
  log(p, `Coded ${ids.length} record(s) to ${d.name}`)
}

// ---------- queries to the site ----------
export function raiseQuery(p: CodingProject, ids: string[], kind: 'split' | 'clarify' | 'not-drug' | 'indication', text: string) {
  needRole(p, 'coder', 'Raising a coding query')
  if (text.trim().length < 10) throw new Error('Write the query to the site: what is unclear and what you need.')
  for (const id of ids) {
    const r = p.records.find((x) => x.id === id)!
    if (kind === 'indication') { Object.assign(r, { status: 'query', indQueried: true, indCode: undefined, reviewedBy: undefined, query: { kind, text: text.trim(), by: me(p).name, utc: now() } }); trail(p, r, `Indication query: ${text.trim()}`); continue }
    Object.assign(r, { status: 'query', queried: true, code: undefined, atc: undefined, reviewedBy: undefined, query: { kind, text: text.trim(), by: me(p).name, utc: now() } })
    trail(p, r, `Query (${kind}): ${text.trim()}`)
  }
  log(p, `Query raised on ${ids.length} record(s)`)
}
// The sites answer every open coding query (in the trainer they answer at once).
export function siteAnswers(p: CodingProject): number {
  let n = 0
  for (const r of p.records.filter((x) => x.status === 'query')) {
    if (r.query?.kind === 'indication') {
      n++
      const k = r.ind ? INDICATIONS[norm(r.ind)] : undefined
      if (k && 'query' in k) { const old = r.ind; r.ind = k.clarify; r.query.answer = `Indication changed to "${k.clarify}"`; trail(p, r, `Site changed the indication from "${old}" to "${k.clarify}"`, 'Site') }
      else { r.query!.answer = 'The indication is correct as entered.'; r.flags = [...(r.flags ?? []), 'Unnecessary query: the site confirmed the indication']; trail(p, r, 'Site: the indication is correct as entered.', 'Site') }
      r.status = r.code ? 'coded' : 'uncoded'; autoIndication(p, r); continue
    }
    const it = r.itemId ? itemFor(r.study, r.form, r.verbatim, r.ind) : undefined
    const ans = it ? answerIn(it, p.sdd) : undefined
    n++
    if (ans && 'query' in ans && ans.query === 'not-drug') { r.status = 'removed'; r.query!.answer = 'Not a medicinal product: moved to the procedures page.'; trail(p, r, 'Site: not a medication; the record was moved off the medications page.', 'Site'); continue }
    if (!ans || !('query' in ans) || !it?.clarify) { r.status = 'uncoded'; r.query!.answer = 'The term is correct as entered.'; r.flags = [...(r.flags ?? []), 'Unnecessary query: the site confirmed the term']; trail(p, r, 'Site: the term is correct as entered.', 'Site'); continue }
    if (it.clarify.length > 1) {
      r.status = 'replaced'; r.query!.answer = `Split into: ${it.clarify.join('; ')}`
      trail(p, r, `Site split the record into ${it.clarify.map((c) => `"${c}"`).join(' and ')}`, 'Site')
      it.clarify.forEach((c, i) => p.records.push({ id: `${r.id}-${i + 1}`, study: r.study, subj: r.subj, form: r.form, verbatim: c, ind: r.ind, itemId: itemFor(r.study, r.form, c, r.ind)?.id, status: 'uncoded', parent: r.id, trail: [{ utc: now(), by: 'Site', what: `New record from the split of ${r.id}: "${c}"` }] }))
    } else {
      const old = r.verbatim
      r.verbatim = it.clarify[0]; r.itemId = itemFor(r.study, r.form, r.verbatim, r.ind)?.id; r.status = 'uncoded'; r.query!.answer = `Changed to "${r.verbatim}"`
      trail(p, r, `Site changed the verbatim from "${old}" to "${r.verbatim}"`, 'Site')
    }
  }
  if (n) log(p, `Sites answered ${n} coding quer${n === 1 ? 'y' : 'ies'}`)
  return n
}

// ---------- review ----------
export function approve(p: CodingProject, ids: string[]) {
  needRole(p, 'reviewer', 'Approving coding')
  for (const id of ids) {
    const r = p.records.find((x) => x.id === id)!
    if (r.status !== 'coded') continue
    if (r.by === me(p).name || r.indBy === me(p).name) throw new Error(`${r.id} was coded by you: coding is approved by a second person.`)
    if (r.form === 'CM' && r.ind && !r.indCode) throw new Error(`${r.id}: code the indication "${r.ind}" before approval (CC-28).`)
    r.status = 'approved'; r.reviewedBy = me(p).name; trail(p, r, 'Approved')
  }
  log(p, `Approved ${ids.length} record(s)`)
}
export function sendBack(p: CodingProject, id: string, comment: string) {
  needRole(p, 'reviewer', 'Sending coding back')
  if (comment.trim().length < 5) throw new Error('Say what is wrong.')
  const r = p.records.find((x) => x.id === id)!
  Object.assign(r, { status: 'uncoded', reviewedBy: undefined, comment: comment.trim() })
  r.flags = [...(r.flags ?? []), `Sent back: ${comment.trim()}`]
  trail(p, r, `Sent back by the reviewer: ${comment.trim()}`); log(p, `Sent back ${id}`)
}

// ---------- synonyms ----------
export function proposeSynonym(p: CodingProject, r: Rec, code: string, atc?: string, scope: string = r.study) {
  const v = norm(r.verbatim)
  if (p.synonyms.some((s) => s.status !== 'retired' && s.verbatim === v && s.dict === (r.form === 'CM' ? 'SDD' : 'SMD') && (s.scope === scope || s.scope === 'company'))) return
  p.synonyms.push({ id: `SYN-${Date.now().toString(36)}${p.synonyms.length}`, scope, dict: r.form === 'CM' ? 'SDD' : 'SMD', verbatim: v, code, atc, status: 'proposed', by: me(p).name, utc: now() })
  log(p, `Synonym proposed: "${v}"`)
}
export function approveSynonym(p: CodingProject, id: string) {
  needRole(p, 'reviewer', 'Approving a synonym')
  const s = p.synonyms.find((x) => x.id === id)!
  if (s.by === me(p).name) throw new Error('You proposed this synonym: a second person approves it.')
  if (s.dict === 'SMD' && !smdOf(p).terms.get(s.code)?.current) throw new Error('The synonym points to a term that is not current.')
  s.status = 'approved'; s.approvedBy = me(p).name; log(p, `Synonym approved: "${s.verbatim}"`)
}
export function retireSynonym(p: CodingProject, id: string, note: string) {
  needRole(p, ['reviewer', 'lead'], 'Retiring a synonym')
  if (note.trim().length < 5) throw new Error('Give the reason the synonym is retired.')
  const s = p.synonyms.find((x) => x.id === id)!
  s.status = 'retired'; s.note = note.trim(); log(p, `Synonym retired: "${s.verbatim}" (${note.trim()})`)
}
// Records the synonym coded (they need reviewing when it is retired).
export const codedBySynonym = (p: CodingProject, s: Synonym) => p.records.filter((r) => r.method === 'synonym' && norm(r.verbatim) === s.verbatim && ['coded', 'approved'].includes(r.status) && (s.dict === 'SDD') === (r.form === 'CM'))
export function uncodeBySynonym(p: CodingProject, id: string) {
  needRole(p, ['reviewer', 'lead', 'coder'], 'Re-opening records')
  const s = p.synonyms.find((x) => x.id === id)!
  const rs = codedBySynonym(p, s)
  for (const r of rs) { Object.assign(r, { status: 'uncoded', code: undefined, atc: undefined, method: undefined, reviewedBy: undefined }); r.flags = [...(r.flags ?? []), `Re-opened: synonym "${s.verbatim}" retired`]; trail(p, r, `Re-opened: coded by the retired synonym "${s.verbatim}"`) }
  log(p, `Re-opened ${rs.length} record(s) coded by "${s.verbatim}"`)
  return rs.length
}

// ---------- grading against the answer key ----------
export interface Verdict { ok: boolean | undefined; why: string; llt?: boolean }
const lltNamed = (d: MedDict, name: string) => (d.byName.get(name.toLowerCase()) ?? []).find((t) => t.level === 'LLT')
export function expectedPt(d: MedDict, a: { pt: string; llt?: string }) {
  const l = a.llt ? lltNamed(d, a.llt) : undefined
  return (l && ptOf(d, l.code)?.name) ?? a.pt
}
// The answer for a record: from the catalogue, or derived for an imported verbatim that matches a
// current term or a single-class drug record exactly.
export function keyFor(p: CodingProject, r: Pick<Rec, 'study' | 'form' | 'verbatim' | 'ind'>): { a: Answer; cc: string } | undefined {
  const it = itemFor(r.study, r.form, r.verbatim, r.ind)
  if (it) return { a: answerIn(it, p.sdd), cc: it.cc }
  if (r.form !== 'CM') { const t = exactLlt(SMD['1.0'], r.verbatim); return t ? { a: { pt: ptOf(SMD['1.0'], t.code)!.name, llt: t.name }, cc: 'CC-01' } : undefined }
  const d = exactDrugIn(p.sdd, r.verbatim)
  if (!d) return undefined
  const atc = d.atc.length === 1 ? d.atc[0] : d.ingredients.join('+') === 'acetylsalicylic acid' ? (/prevent|heart|stroke|thromb/i.test(r.ind ?? '') ? 'W01AC' : 'K02BA') : undefined
  return atc ? { a: { ing: d.ingredients.join('+'), atc, trade: d.generic ? undefined : d.name }, cc: 'CC-21' } : undefined
}
export function indicationVerdict(p: CodingProject, r: Rec): Verdict | undefined {
  if (r.form !== 'CM' || !r.ind || r.status === 'replaced' || r.status === 'removed') return undefined
  const k = INDICATIONS[norm(r.ind)]
  if (k && 'query' in k) return r.indQueried ? { ok: true, why: 'Indication queried.' } : { ok: false, why: `The indication "${r.ind}" is too vague to code: query it (CC-28).` }
  if (!r.indCode) return { ok: undefined, why: 'Indication not coded yet.' }
  const d = smdOf(p), want = indicationLlt(r.ind, d), got = d.terms.get(r.indCode)
  if (!want) return { ok: undefined, why: 'Indication not in the answer key.' }
  if (ptOf(d, got!.code)?.name !== ptOf(d, want.code)?.name) return { ok: false, why: `Indication coded to ${got?.name}; expected ${want.name} (CC-28).` }
  return { ok: true, why: 'Indication correct.' }
}
export function verdict(p: CodingProject, r: Rec): Verdict {
  const v = drugOrMedVerdict(p, r)
  const iv = indicationVerdict(p, r)
  if (v.ok && iv && iv.ok === false) return { ok: false, why: iv.why }
  if (v.ok && iv && iv.ok === undefined) return { ok: undefined, why: `${v.why} ${iv.why}` }
  return v
}
function drugOrMedVerdict(p: CodingProject, r: Rec): Verdict {
  const key = keyFor(p, r)
  if (!key) return { ok: undefined, why: 'Not in the answer key.' }
  const it = { cc: key.cc }
  const a: Answer = key.a
  if ('query' in a) {
    if (r.status === 'replaced' || r.status === 'removed') return { ok: true, why: 'Queried and resolved by the site.' }
    if (r.status === 'query') return { ok: true, why: 'Query open with the site.' }
    if (['coded', 'approved'].includes(r.status)) return { ok: false, why: `This term needed a query (${it.cc}): ${a.query === 'split' ? 'separate events' : a.query === 'not-drug' ? 'not a medication' : 'unclear term'}.` }
    return { ok: undefined, why: 'Not resolved yet.' }
  }
  if (!['coded', 'approved'].includes(r.status)) return { ok: undefined, why: r.status === 'query' ? 'Queried, but the term could be coded as reported.' : 'Not coded yet.' }
  if ('pt' in a) {
    const d = smdOf(p), t = d.terms.get(r.code ?? '')
    if (!t) return { ok: false, why: 'No term.' }
    if (!t.current) return { ok: false, why: `${t.name} is not current in SMD ${p.smd}: recode (CC-01).` }
    const want = expectedPt(d, a), got = ptOf(d, t.code)?.name
    if (got !== want) return { ok: false, why: `Preferred term ${got}; expected ${want} (${it.cc}).` }
    const best = a.llt && t.name.toLowerCase() !== a.llt.toLowerCase()
    return { ok: true, why: best ? `Right preferred term; the closest LLT is ${a.llt} (CC-01).` : 'Correct.', llt: !best }
  }
  const dr = drugRec(p.sdd, r.code)
  if (!dr) return { ok: false, why: 'No drug record.' }
  if (dr.ingredients.join('+') !== a.ing) return { ok: false, why: `Coded to ${dr.ingredients.join(' + ')}; expected ${a.ing.replace('+', ' + ')} (${it.cc}).` }
  if (r.atc !== a.atc) return { ok: false, why: `Class ${r.atc}; for "${r.ind}" the class is ${a.atc} ${atcByCode.get(a.atc)?.name ?? ''} (${it.cc}).` }
  const tradeOk = !a.trade || dr.name === a.trade
  return { ok: true, why: tradeOk ? 'Correct.' : `Right ingredient and class; the reported trade name has its own record, ${a.trade} (CC-21).`, llt: tradeOk }
}

// ---------- the numbers ----------
export function stats(p: CodingProject) {
  const live = p.records.filter((r) => !['replaced', 'removed'].includes(r.status))
  const v = p.records.map((r) => verdict(p, r))
  const judged = v.filter((x) => x.ok !== undefined)
  const coded = live.filter((r) => ['coded', 'approved'].includes(r.status))
  return {
    total: live.length, uncoded: live.filter((r) => r.status === 'uncoded').length, coded: coded.length, approved: live.filter((r) => r.status === 'approved').length,
    queries: p.records.filter((r) => r.status === 'query').length, queried: p.records.filter((r) => r.queried).length,
    auto: coded.filter((r) => r.method === 'auto').length, synonym: coded.filter((r) => r.method === 'synonym').length, manual: coded.filter((r) => r.method === 'manual').length,
    correct: judged.filter((x) => x.ok).length, wrong: judged.filter((x) => x.ok === false).length, judged: judged.length,
    accuracy: judged.length ? Math.round((1000 * judged.filter((x) => x.ok).length) / judged.length) / 10 : 0,
    precise: v.filter((x) => x.ok && x.llt).length,
    unnecessary: p.records.filter((r) => r.flags?.some((f) => f.startsWith('Unnecessary query'))).length,
    inconsistent: consistency(p).length,
  }
}

// The same verbatim coded two ways (across studies too): the company codes one way.
export function consistency(p: CodingProject) {
  const groups = new Map<string, Rec[]>()
  for (const r of p.records.filter((x) => ['coded', 'approved'].includes(x.status))) {
    const k = `${r.form === 'CM' ? 'CM' : 'MED'}|${norm(r.verbatim)}${r.form === 'CM' ? `|${norm(r.ind ?? '')}` : ''}`
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  const out: { verbatim: string; ind?: string; codings: { label: string; ids: string[] }[] }[] = []
  for (const rs of groups.values()) {
    const by = new Map<string, string[]>()
    for (const r of rs) { const l = label(p, r); by.set(l, [...(by.get(l) ?? []), r.id]) }
    if (by.size > 1) out.push({ verbatim: rs[0].verbatim, ind: rs[0].form === 'CM' ? rs[0].ind : undefined, codings: [...by.entries()].map(([label, ids]) => ({ label, ids })) })
  }
  return out
}
export function label(p: CodingProject, r: Rec): string {
  if (!r.code) return '(none)'
  if (r.form === 'CM') { const d = drugRec(p.sdd, r.code); return d ? `${d.name} · ${r.atc}` : r.code }
  const d = smdOf(p), t = d.terms.get(r.code)
  return t ? `${t.name} → ${ptOf(d, t.code)?.name ?? '?'}` : r.code
}
export const hierarchy = (p: CodingProject, code: string): Term[] => path(smdOf(p), code)
export type { Item }
