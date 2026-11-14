// Data retrieval: getting coded events back out for safety review. MedDRA ships Standardised
// MedDRA Queries (SMQs): ready-made groups of preferred terms for one medical concept, with a
// narrow scope (terms very likely to mean the concept) and a broad scope (adding terms that may).
// The training dictionary has its own Standard Search Groups (SSG) built the same way; they are
// invented, not SMQ content. ICH's "MedDRA Data Retrieval and Presentation: Points to Consider"
// covers when to use them, custom queries, and primary versus secondary system classes.
import { ptOf, path, secondarySocs } from './dictmed'
import { smdOf, type CodingProject, type Rec } from './coding'

export interface SearchGroup { id: string; name: string; narrow: string[]; broad: string[]; note: string }
export const GROUPS: SearchGroup[] = [
  { id: 'SSG-01', name: 'Hypotension and fainting', narrow: ['Low blood pressure', 'Fainting'], broad: ['Light-headedness', 'Fall'], note: 'Broad adds terms that often follow low blood pressure but have other causes.' },
  { id: 'SSG-02', name: 'Hypersensitivity', narrow: ['Angioedema', 'Urticaria'], broad: ['Rash', 'Itching', 'Wheezing'], note: 'A rash or itch alone is not hypersensitivity, so they are in the broad scope only.' },
  { id: 'SSG-03', name: 'Potassium increase', narrow: ['High potassium', 'Blood potassium raised'], broad: ['Creatinine raised', 'Acute kidney injury'], note: 'Narrow combines the diagnosis and the test-result term: the same finding is coded either way (CC-10).' },
  { id: 'SSG-04', name: 'Heart rhythm disorders', narrow: ['Atrial fibrillation event', 'Fast heart rate', 'Slow heart rate', 'QT prolongation'], broad: ['Fainting', 'Light-headedness'], note: 'Fainting and dizziness may be rhythm-related.' },
  { id: 'SSG-05', name: 'Respiratory infections', narrow: ['Upper respiratory tract infection', 'Pneumonia'], broad: ['Cough', 'Sore throat', 'Fever'], note: 'Symptoms without a diagnosis are broad only.' },
  { id: 'SSG-06', name: 'Application and injection site reactions', narrow: ['Application site irritation', 'Injection site reaction'], broad: [], note: 'Narrow only.' },
]
const events = (p: CodingProject, studies?: string[]) => p.records.filter((r) => r.form === 'AE' && ['coded', 'approved'].includes(r.status) && r.code && (!studies?.length || studies.includes(r.study)))
const ptName = (p: CodingProject, r: Rec) => ptOf(smdOf(p), r.code!)?.name ?? ''
export function runPts(p: CodingProject, pts: string[], studies?: string[]) {
  const set = new Set(pts)
  const rs = events(p, studies).filter((r) => set.has(ptName(p, r)))
  const byPt = new Map<string, number>(); for (const r of rs) byPt.set(ptName(p, r), (byPt.get(ptName(p, r)) ?? 0) + 1)
  return { records: rs, participants: new Set(rs.map((r) => `${r.study}|${r.subj}`)).size, byPt: [...byPt.entries()].sort((a, b) => b[1] - a[1]) }
}
export const runGroup = (p: CodingProject, g: SearchGroup, scope: 'narrow' | 'broad', studies?: string[]) => runPts(p, scope === 'narrow' ? g.narrow : [...g.narrow, ...g.broad], studies)
// Events by system class: by primary class only (as tables count) or by any linked class.
export function bySoc(p: CodingProject, soc: string, secondary: boolean, studies?: string[]) {
  const d = smdOf(p)
  const rs = events(p, studies).filter((r) => { const pt = ptOf(d, r.code!); if (!pt) return false; return path(d, pt.code)[0]?.name === soc || (secondary && secondarySocs(d, pt.code).some((x) => x.name === soc)) })
  return { records: rs, participants: new Set(rs.map((r) => `${r.study}|${r.subj}`)).size }
}

// The questions of mission M6. Answers are computed from the project as it stands.
export interface Question { id: string; text: string; answer: (p: CodingProject) => string; hint: string }
export const QUESTIONS: Question[] = [
  { id: 'Q1', text: 'How many HLV-204-201 participants had an event in SSG-01 Hypotension and fainting, narrow scope?', answer: (p) => String(runGroup(p, GROUPS[0], 'narrow', ['HLV-204-201']).participants), hint: 'Count participants, not records.' },
  { id: 'Q2', text: 'And in the broad scope?', answer: (p) => String(runGroup(p, GROUPS[0], 'broad', ['HLV-204-201']).participants), hint: 'Broad includes narrow.' },
  { id: 'Q3', text: 'How many adverse event records, in all three studies, are in the system class Infections counting primary classes only?', answer: (p) => String(bySoc(p, 'Infections', false).records.length), hint: 'This is how incidence tables count.' },
  { id: 'Q4', text: 'How many records are in Skin counting primary and secondary classes? (Shingles, cellulitis and others link there.)', answer: (p) => String(bySoc(p, 'Skin', true).records.length), hint: 'Secondary links find events that tables put in another class.' },
  { id: 'Q5', text: 'How many DRM-501-201 participants had an event in SSG-02 Hypersensitivity, broad scope?', answer: (p) => String(runGroup(p, GROUPS[1], 'broad', ['DRM-501-201']).participants), hint: 'The rash and itching terms count in broad.' },
]
// The custom query the mission asks for: every potassium disturbance, up and down.
export const POTASSIUM_PTS = ['High potassium', 'Blood potassium raised', 'Low potassium']
export function customPotassiumOk(p: CodingProject) {
  const q = (p.customQueries ?? []).find((x) => /potassium/i.test(x.name))
  return !!q && POTASSIUM_PTS.every((t) => q.pts.includes(t)) && q.pts.every((t) => POTASSIUM_PTS.includes(t))
}
export function saveCustomQuery(p: CodingProject, name: string, pts: string[], by: string) {
  if (name.trim().length < 3) throw new Error('Name the query.')
  if (!pts.length) throw new Error('Choose at least one preferred term.')
  p.customQueries = [...(p.customQueries ?? []).filter((x) => x.name !== name.trim()), { id: `CQ-${Date.now().toString(36)}`, name: name.trim(), pts: [...new Set(pts)], by }]
}
