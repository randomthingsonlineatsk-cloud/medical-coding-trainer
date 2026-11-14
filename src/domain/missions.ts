// Missions: set coding tasks graded against the answer key. The grade reads the project itself.
import { createProject, autoencode, raiseQuery, codeMed, codeDrug, codeIndication, approve, siteAnswers, stats, consistency, verdict, keyFor, indicationLlt, indicationVerdict, isForeign, smdOf, sddList, BAD_SYNONYMS, companySynonyms, type CodingProject, type Rec } from './coding'
import { QUESTIONS, customPotassiumOk } from './retrieval'
import { assistantStats, suggestAll } from './assistant'
import { INDICATIONS } from './catalogue'
import { itemFor, answerIn, norm, CATALOGUE } from './catalogue'
import { staleSynonyms } from './upgrade'
import { hash } from './util'

export type Level = 'guided' | 'standard' | 'expert'
export interface Goal { id: string; text: string; hint: string; weight: number; met: (p: CodingProject) => boolean }
export interface Mission { id: string; title: string; brief: string; make: (name: string) => CodingProject; goals: Goal[] }

const ALL = ['HLV-204-201', 'RSP-118-302', 'DRM-501-201']
const live = (p: CodingProject) => p.records.filter((r) => !['replaced', 'removed'].includes(r.status))
const resolved = (p: CodingProject) => live(p).every((r) => ['coded', 'approved'].includes(r.status))
const allApproved = (p: CodingProject) => live(p).length > 0 && live(p).every((r) => r.status === 'approved' && r.reviewedBy && r.reviewedBy !== r.by)
const keyOf = (p: CodingProject, r: Rec) => keyFor(p, r)?.a
const queriesRight = (p: CodingProject) => p.records.filter((r) => { const a = keyOf(p, r); return a && 'query' in a }).every((r) => r.queried)
const noUnneeded = (p: CodingProject) => stats(p).unnecessary === 0 && p.records.filter((r) => r.status === 'query').every((r) => { const a = keyOf(p, r); return a && 'query' in a })
const precision = (p: CodingProject) => { const s = stats(p); return s.correct ? s.precise / s.correct : 0 }
const badRetired = (p: CodingProject) => Object.keys(BAD_SYNONYMS).every((v) => !p.synonyms.some((s) => s.scope === 'company' && s.verbatim === v && s.status === 'approved'))
const goodKept = (p: CodingProject) => companySynonyms().filter((s) => !BAD_SYNONYMS[s.verbatim]).every((g) => p.synonyms.some((s) => s.verbatim === g.verbatim && s.status === 'approved'))
// An approved study synonym is right when it codes its verbatim the way the answer key does.
export function synonymRight(p: CodingProject, verbatim: string, dict: 'SMD' | 'SDD', code: string): boolean | undefined {
  const it = CATALOGUE.find((x) => norm(x.v) === verbatim && (dict === 'SDD') === (x.form === 'CM'))
  if (!it) return undefined
  const a = answerIn(it, p.sdd)
  if ('query' in a) return false
  if ('pt' in a) { const d = smdOf(p), t = d.terms.get(code); return !!t && verdict(p, { ...stub(it), code, status: 'coded' }).ok === true }
  const r = sddList(p).find((d) => d.id === code)
  return !!r && r.ingredients.join('+') === a.ing
}
const stub = (it: (typeof CATALOGUE)[number]): Rec => ({ id: 'x', study: it.study, subj: '', form: it.form, verbatim: it.v, ind: it.ind, itemId: it.id, status: 'coded', trail: [] })

export const MISSIONS: Mission[] = [
  {
    id: 'M1', title: 'Code the adverse events and medical history of HLV-204-201',
    brief: 'Run the autoencoder, code what it leaves, query what cannot be coded, and have every record approved by a reviewer who did not code it. Watch what the company synonym list does.',
    make: (name) => createProject({ name, studies: ['HLV-204-201'], forms: ['AE', 'MH'], seed: 11 }),
    goals: [
      { id: 'res', text: 'Every record is coded (no uncoded record, no open query)', hint: 'After queries, receive the site answers and code the new verbatims.', weight: 10, met: resolved },
      { id: 'acc', text: 'Accuracy 95% or more against the answer key', hint: 'Check autoencoded records too: a synonym can be wrong.', weight: 25, met: (p) => stats(p).accuracy >= 95 && stats(p).judged > 0 },
      { id: 'q', text: 'Every term that needs a query was queried', hint: 'Vague terms, two events in one, an event with its consequence (CC-05, CC-06, CC-07).', weight: 15, met: queriesRight },
      { id: 'nq', text: 'No unnecessary queries', hint: 'A misspelling with a clear meaning is coded, not queried (CC-03).', weight: 10, met: noUnneeded },
      { id: 'llt', text: 'The closest LLT for 90% or more of correct records', hint: 'Pick the LLT nearest the reported words (CC-01).', weight: 10, met: (p) => precision(p) >= 0.9 },
      { id: 'rev', text: 'Every record approved by a second person', hint: 'Switch to the reviewer to approve.', weight: 20, met: allApproved },
      { id: 'con', text: 'No verbatim coded two ways', hint: 'The consistency report on the Review page.', weight: 10, met: (p) => consistency(p).length === 0 },
    ],
  },
  {
    id: 'M2', title: 'Code the concomitant medications of three studies',
    brief: 'Trade names, misspellings, salts, combinations and drugs with more than one class. Choose the class from the indication and route, and query class names and non-drugs.',
    make: (name) => createProject({ name, studies: ALL, forms: ['CM'], seed: 12 }),
    goals: [
      { id: 'res', text: 'Every record is coded', hint: 'The autoencoder stops at records with more than one class: you choose.', weight: 15, met: resolved },
      { id: 'acc', text: 'Accuracy 95% or more', hint: 'Ingredient and class must both be right.', weight: 25, met: (p) => stats(p).accuracy >= 95 && stats(p).judged > 0 },
      { id: 'cls', text: 'Every multi-class drug has the class its indication and route call for', hint: 'Aspirin, fluticasone, mometasone and budesonide (CC-25).', weight: 15, met: (p) => p.records.filter((r) => r.form === 'CM' && ['coded', 'approved'].includes(r.status) && /aspirin|flut|nasoflute|mometasone|budesonide/i.test(r.verbatim)).every((r) => verdict(p, r).ok === true) },
      { id: 'q', text: 'Class names and non-drugs queried, and nothing else', hint: 'CC-26, CC-27.', weight: 15, met: (p) => queriesRight(p) && noUnneeded(p) },
      { id: 'trade', text: 'Reported trade names coded to their trade-name records (90% or more)', hint: 'CC-21.', weight: 10, met: (p) => precision(p) >= 0.9 },
      { id: 'ind', text: 'Every indication coded with the medical dictionary, correctly', hint: 'CC-28: the autoencoder codes exact indications; code the rest in the indication panel.', weight: 10, met: (p) => live(p).filter((r) => r.form === 'CM' && r.ind).every((r) => indicationVerdict(p, r)?.ok === true) },
      { id: 'rev', text: 'Every record approved by a second person', hint: 'Switch to the reviewer.', weight: 20, met: allApproved },
    ],
  },
  {
    id: 'M3', title: 'Audit the synonym list',
    brief: 'The company synonym list feeds the autoencoder for every study, so one bad entry miscodes records everywhere. The three studies have been autoencoded with it. Find the entries that should not be there, retire them, re-open what they coded and code it properly; add study synonyms for terms that recur.',
    make: (name) => { const p = createProject({ name, studies: ALL, forms: ['AE', 'MH', 'CM'], seed: 13 }); autoencode(p); p.history.push({ utc: new Date().toISOString(), by: 'System', what: 'Mission start: autoencoded with the company synonym list' }); return p },
    goals: [
      { id: 'bad', text: 'All five bad company synonyms retired', hint: 'Look for vague terms, added diagnoses and a fixed drug class.', weight: 25, met: badRetired },
      { id: 'good', text: 'No good company synonym retired', hint: 'A misspelling or abbreviation with one meaning is a good synonym.', weight: 10, met: goodKept },
      { id: 'fix', text: 'The records the bad synonyms coded are re-opened and resolved correctly', hint: 'Retiring a synonym does not recode what it already coded: re-open them.', weight: 20, met: (p) => p.records.filter((r) => Object.keys(BAD_SYNONYMS).includes(norm(r.trail[0]?.what.replace(/^Verbatim received: "|"$/g, '') ?? ''))).every((r) => verdict(p, r).ok === true) },
      { id: 'new', text: 'At least three new study synonyms, approved by someone other than their proposer', hint: 'Code a misspelling manually with "add as a synonym", then approve it as the reviewer.', weight: 15, met: (p) => p.synonyms.filter((s) => s.scope !== 'company' && s.status === 'approved' && s.approvedBy && s.approvedBy !== s.by).length >= 3 },
      { id: 'right', text: 'Every approved study synonym codes its term correctly', hint: 'A synonym must never stand in for a query.', weight: 15, met: (p) => p.synonyms.filter((s) => s.scope !== 'company' && s.status === 'approved').every((s) => synonymRight(p, s.verbatim, s.dict, s.code) !== false) },
      { id: 'acc', text: 'Accuracy 95% or more', hint: 'Code what is left after the re-opening.', weight: 15, met: (p) => stats(p).accuracy >= 95 },
    ],
  },
  {
    id: 'M4', title: 'Upgrade the dictionaries mid-study',
    brief: 'All three studies are coded and approved on SMD 1.0 and SDD 2026 Q1. The data management plan calls for the new versions before the integrated safety analysis. Review the impact, apply the upgrade as the coding lead, recode what must be recoded, query what has become ambiguous, fix the synonym list and re-approve.',
    make: (name) => {
      const p = createProject({ name, studies: ALL, forms: ['AE', 'MH', 'CM'], seed: 14 })
      // The company list was cleaned at its June review; the studies were then autoencoded and finished by hand.
      for (const syn of p.synonyms) if (BAD_SYNONYMS[syn.verbatim]) { syn.status = 'retired'; syn.note = 'Retired at the company synonym review, June 2026.' }
      const as = p.as; p.as = p.team.findIndex((m) => m.role === 'lead'); autoencode(p); p.as = as
      solve(p); return p
    },
    goals: [
      { id: 'imp', text: 'Upgrade to SMD 1.1 and SDD 2026 Q3 applied and signed by the coding lead', hint: 'Upgrade page: review the impact, then apply.', weight: 15, met: (p) => p.smd === '1.1' && p.sdd === 'Q3' && p.upgrades.some((u) => u.signed.name) },
      { id: 'recode', text: 'Records on retired LLTs recoded to current terms', hint: 'CC-01: never keep a non-current LLT.', weight: 20, met: (p) => p.smd === '1.1' && live(p).filter((r) => r.form !== 'CM' && r.code).every((r) => smdOf(p).terms.get(r.code!)?.current) && !live(p).some((r) => r.flags?.some((f) => f.startsWith('Recode')) && r.status === 'uncoded') },
      { id: 'calm', text: 'Calmadol records queried (the name now means another product)', hint: 'CC-22: ask which product the participant took.', weight: 15, met: (p) => p.sdd === 'Q3' && p.records.filter((r) => r.trail[0]?.what.includes('"Calmadol"')).every((r) => r.queried) },
      { id: 'rev', text: 'Every changed record re-approved by a reviewer', hint: 'An upgrade withdraws approval from the records it changes.', weight: 15, met: (p) => p.smd === '1.1' && allApproved(p) },
      { id: 'syn', text: 'No synonym points to a retired term', hint: 'Synonyms page: retarget or retire them.', weight: 10, met: (p) => p.smd === '1.1' && staleSynonyms(p).length === 0 },
      { id: 'acc', text: 'Accuracy 98% or more on the new versions', hint: 'Class changes and PT changes follow automatically; check them.', weight: 15, met: (p) => p.smd === '1.1' && stats(p).accuracy >= 98 },
      { id: 'con', text: 'No verbatim coded two ways', hint: 'Consistency report.', weight: 10, met: (p) => p.smd === '1.1' && consistency(p).length === 0 },
    ],
  },
  {
    id: 'M5', title: 'Code three studies at scale',
    brief: 'About 480 verbatims from three studies: adverse events, medical history and medications. Use the autoencoder, fix the synonym list, code and query the rest, and get everything approved, consistent and right.',
    make: (name) => createProject({ name, studies: ALL, forms: ['AE', 'MH', 'CM'], seed: 15 }),
    goals: [
      { id: 'res', text: 'Every record coded', hint: 'Group the manual queue by verbatim and code a group at once.', weight: 15, met: resolved },
      { id: 'acc', text: 'Accuracy 95% or more', hint: 'Bad synonyms autoencode wrongly at scale.', weight: 25, met: (p) => stats(p).accuracy >= 95 && stats(p).judged > 0 },
      { id: 'q', text: 'All queries needed, none unnecessary', hint: 'CC-05 to CC-07, CC-26, CC-27.', weight: 15, met: (p) => queriesRight(p) && noUnneeded(p) },
      { id: 'bad', text: 'The bad company synonyms retired', hint: 'Synonyms page.', weight: 10, met: badRetired },
      { id: 'rev', text: 'Every record approved by a second person', hint: 'Review page: approve in groups.', weight: 15, met: allApproved },
      { id: 'con', text: 'No verbatim coded two ways', hint: 'Consistency report.', weight: 10, met: (p) => consistency(p).length === 0 },
      { id: 'llt', text: 'The closest LLT or trade record for 90% or more', hint: 'CC-01, CC-21.', weight: 10, met: (p) => precision(p) >= 0.9 },
    ],
  },
  {
    id: 'M6', title: 'Retrieve the safety data',
    brief: 'The three studies are coded and approved. The safety physician asks five questions and needs a custom query. Use the standard search groups (narrow and broad), the system-class counts with and without secondary links, and build a custom query on the Retrieval page.',
    make: (name) => { const p = createProject({ name, studies: ALL, forms: ['AE', 'MH', 'CM'], seed: 16 }); solve(p); return p },
    goals: [
      ...QUESTIONS.map((q) => ({ id: q.id, text: q.text, hint: q.hint, weight: 15, met: (p: CodingProject) => (p.answers?.[q.id] ?? '').trim() === q.answer(p) })),
      { id: 'cq', text: 'A custom query "Potassium disturbances" with every potassium preferred term, up and down, and nothing else', hint: 'Three PTs: the diagnosis and test-result terms for a high value, and the low-potassium term.', weight: 25, met: customPotassiumOk },
    ],
  },
  {
    id: 'M7', title: 'Code with the AI assistant',
    brief: 'An AI coding assistant suggests a term for each verbatim the autoencoder leaves. It is usually right and sometimes confidently wrong. Decide every suggestion: accept the right ones, reject the wrong ones with a reason and code them yourself. You stay responsible for every code.',
    make: (name) => {
      const p = createProject({ name, studies: ALL, forms: ['AE', 'MH', 'CM'], seed: 17 })
      for (const syn of p.synonyms) if (BAD_SYNONYMS[syn.verbatim]) { syn.status = 'retired'; syn.note = 'Retired at the company synonym review, June 2026.' }
      p.assistant = true
      const as = p.as; p.as = p.team.findIndex((m) => m.role === 'lead'); autoencode(p); suggestAll(p); p.as = as
      return p
    },
    goals: [
      { id: 'acc', text: 'Accuracy 95% or more', hint: 'Check each suggestion against the conventions before accepting.', weight: 20, met: (p) => stats(p).accuracy >= 95 && stats(p).judged > 0 },
      { id: 'bias', text: 'No wrong suggestion accepted', hint: 'High confidence is not proof. Look for added diagnoses, the route of a multi-class drug, guessed products and ambiguous translations.', weight: 25, met: (p) => assistantStats(p).acceptedWrong === 0 },
      { id: 'eff', text: 'At least 85% of the right suggestions accepted', hint: 'Rejecting good suggestions wastes the tool.', weight: 10, met: (p) => { const a = assistantStats(p); return a.right > 0 && a.acceptedRight / a.right >= 0.85 } },
      { id: 'dec', text: 'Every suggestion decided', hint: 'Accept or reject; a rejection needs a reason.', weight: 10, met: (p) => assistantStats(p).shown > 0 && assistantStats(p).undecided === 0 },
      { id: 'q', text: 'All queries needed, none unnecessary', hint: 'CC-05 to CC-07, CC-12, CC-26, CC-27.', weight: 15, met: (p) => queriesRight(p) && noUnneeded(p) },
      { id: 'rev', text: 'Every record approved by a second person', hint: 'Review page.', weight: 20, met: allApproved },
    ],
  },
]

// The answer key applied by the system (for the M4 start and the tests): every record coded to
// its best answer, queries answered, and everything approved by the reviewer.
export function solve(p: CodingProject) {
  const as = p.as
  const role = (r: 'coder' | 'reviewer') => { p.as = p.team.findIndex((m) => m.role === r) }
  for (let round = 0; round < 3; round++) {
    role('coder')
    for (const r of p.records.filter((x) => x.status === 'uncoded' || (x.status === 'coded' && verdict(p, x).ok === false))) {
      const a = keyOf(p, r)
      if (!a) continue
      if ('query' in a) { raiseQuery(p, [r.id], a.query, 'Please clarify the term so it can be coded.'); continue }
      if ('pt' in a) {
        const d = smdOf(p)
        const t = [...d.terms.values()].find((x) => x.level === 'LLT' && x.current && x.name.toLowerCase() === (a.llt ?? a.pt).toLowerCase())
        const en = itemFor(r.study, r.form, r.verbatim, r.ind)?.en ?? 'translation checked'
        if (t) codeMed(p, [r.id], t.code, false, isForeign(r) ? en : '')
      } else {
        const list = sddList(p)
        const rec = list.find((d) => d.name === a.trade && d.ingredients.join('+') === a.ing) ?? list.find((d) => d.generic && d.ingredients.join('+') === a.ing)
        if (rec) codeDrug(p, [r.id], rec.id, a.atc)
      }
    }
    for (const r of p.records.filter((x) => x.form === 'CM' && x.ind && !x.indCode && ['coded', 'uncoded'].includes(x.status))) {
      const k = INDICATIONS[norm(r.ind!)]
      if (k && 'query' in k) { if (r.status === 'coded') raiseQuery(p, [r.id], 'indication', 'The indication is too vague to code. Please give the condition the medication was taken for.'); continue }
      const t = indicationLlt(r.ind!, smdOf(p))
      if (t) codeIndication(p, [r.id], t.code)
    }
    siteAnswers(p)
  }
  role('reviewer')
  approve(p, p.records.filter((r) => r.status === 'coded').map((r) => r.id))
  p.as = as
  return p
}

export const missionOf = (p: CodingProject) => MISSIONS.find((m) => m.id === p.mission?.id)
export function startMission(id: string, level: Level): CodingProject {
  const m = MISSIONS.find((x) => x.id === id)!
  const p = m.make(`Mission ${m.id}: ${m.title}`)
  p.mission = { id, level, startedUtc: new Date().toISOString() }
  return p
}
export function grade(p: CodingProject) {
  const m = missionOf(p)
  if (!m) return null
  const results = m.goals.map((g) => { let ok = false; try { ok = g.met(p) } catch { ok = false } return { ...g, ok } })
  const total = results.reduce((s, g) => s + g.weight, 0)
  const score = Math.round((100 * results.filter((g) => g.ok).reduce((s, g) => s + g.weight, 0)) / total)
  return { mission: m, results, score, passed: score >= 80 }
}
export function submitMission(p: CodingProject) {
  const g = grade(p)
  if (!g) throw new Error('This project is not a mission.')
  p.mission!.endedUtc = new Date().toISOString(); p.mission!.score = g.score
  p.mission!.detail = g.results.map((r) => `${r.ok ? 'Met' : 'Not met'}: ${r.text}`)
  p.history.push({ utc: p.mission!.endedUtc, by: 'System', what: `Mission ${g.mission.id} submitted: ${g.score}%` })
  return g
}

export const CERT_NEEDED = MISSIONS.length
export function bestRuns(projects: CodingProject[]) {
  return MISSIONS.map((m) => ({ id: m.id, title: m.title, p: projects.filter((p) => p.mission?.id === m.id && p.mission.endedUtc && (p.mission.score ?? 0) >= 80).sort((a, b) => (b.mission!.score ?? 0) - (a.mission!.score ?? 0))[0] }))
}
export function certificate(projects: CodingProject[], userId: string, name: string) {
  const runs = bestRuns(projects), passed = runs.filter((r) => r.p)
  const basis = `${name.trim().toLowerCase()}|${passed.map((r) => `${r.id}:${r.p!.mission!.score}:${r.p!.mission!.level}`).join(',')}|${userId}`
  const h = hash(basis).slice(-10).toUpperCase()
  return { eligible: passed.length >= CERT_NEEDED, runs, basis, code: `MCT-${h.slice(0, 5)}-${h.slice(5)}`, distinction: passed.length >= CERT_NEEDED && passed.filter((r) => r.p!.mission!.level === 'expert').length >= 3 }
}
