import { describe, expect, test } from 'vitest'
import { createProject, autoencode, codeMed, codeDrug, codeIndication, raiseQuery, siteAnswers, approve, verdict, indicationVerdict, smdOf, sddList, me, type CodingProject, type Role } from '../src/domain/coding'
import { exactLltAny, exactLlt, SMD_10 } from '../src/domain/dictmed'
import { parseCsv } from '../src/domain/importer'
import { GROUPS, runGroup, bySoc, QUESTIONS, saveCustomQuery, customPotassiumOk, POTASSIUM_PTS } from '../src/domain/retrieval'
import { suggestAll, acceptSuggestion, rejectSuggestion, assistantStats, suggestionRight, setAssistant } from '../src/domain/assistant'
import { startMission, grade, solve } from '../src/domain/missions'

const as = (p: CodingProject, r: Role) => { p.as = p.team.findIndex((m) => m.role === r); return me(p) }
const llt = (n: string) => exactLlt(SMD_10, n)!.code

describe('verbatims in other languages', () => {
  test('exact language-version terms autoencode; others need a recorded translation', () => {
    expect(exactLltAny(SMD_10, 'Kopfschmerzen')).toMatchObject({ lang: 'de' })
    const p = createProject({ name: 't', studies: ['HLV-204-201'], forms: ['AE'] }); as(p, 'coder'); autoencode(p)
    const de = p.records.find((r) => r.verbatim === 'Kopfschmerzen')!
    expect(de.status).toBe('coded'); expect(de.lang).toBe('de'); expect(verdict(p, de).ok).toBe(true)
    const kw = p.records.find((r) => r.verbatim === 'Kopfweh')!
    expect(() => codeMed(p, [kw.id], llt('Headache'))).toThrow(/translation/)
    codeMed(p, [kw.id], llt('Headache'), false, 'Headache (colloquial German)')
    expect(kw.translation).toContain('colloquial'); expect(verdict(p, kw).ok).toBe(true)
    const sw = p.records.find((r) => r.verbatim === 'Schwindel')!
    codeMed(p, [sw.id], llt('Dizziness'), false, 'dizziness'); expect(verdict(p, sw).ok).toBe(false)
    raiseQuery(p, [sw.id], 'clarify', 'Schwindel: light-headedness or spinning vertigo?'); siteAnswers(p)
    expect(sw.verbatim).toBe('Schwindelgefühl')
  })
})

describe('indications', () => {
  test('autoencoded, coded by hand, required for approval, and graded', () => {
    const p = createProject({ name: 't', studies: ['HLV-204-201'], forms: ['CM'] }); as(p, 'coder'); autoencode(p)
    const asp = p.records.find((r) => r.verbatim === 'Aspirin' && r.ind === 'Prevention of heart attack')!
    codeDrug(p, [asp.id], sddList(p).find((d) => d.name === 'Aspirin')!.id, 'W01AC')
    expect(asp.indCode).toBeTruthy() // "Prevention of heart attack" is an LLT
    const ator = p.records.find((r) => r.verbatim === 'Atorvastatin')!
    expect(indicationVerdict(p, ator)?.ok).toBe(true)
    codeIndication(p, [ator.id], llt('Back pain')); expect(verdict(p, ator).ok).toBe(false)
    as(p, 'reviewer'); approve(p, [asp.id]); expect(asp.status).toBe('approved')
  })
  test('a medication whose indication is not coded cannot be approved', () => {
    const p = createProject({ name: 't', studies: ['HLV-204-201'], forms: ['CM'] }); as(p, 'coder')
    const r = p.records.find((x) => x.verbatim === 'Lipidra 20 mg')!
    r.ind = 'Something vague'; codeDrug(p, [r.id], sddList(p).find((d) => d.name === 'Lipidra')!.id, 'F10AA')
    as(p, 'reviewer'); expect(() => approve(p, [r.id])).toThrow(/indication/)
  })
})

describe('import from the CDM console', () => {
  test('CSV parsing handles quotes and line ends', () => {
    expect(parseCsv('A,B\r\n"x, y","he said ""hi"""\r\n')).toEqual([['A', 'B'], ['x, y', 'he said "hi"']])
  })
})

describe('retrieval', () => {
  test('search groups, primary and secondary classes, custom query', () => {
    const p = startMission('M6', 'standard')
    const n = runGroup(p, GROUPS[0], 'narrow'), b = runGroup(p, GROUPS[0], 'broad')
    expect(b.records.length).toBeGreaterThan(n.records.length)
    expect(bySoc(p, 'Skin', true).records.length).toBeGreaterThan(bySoc(p, 'Skin', false).records.length)
    p.answers = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.answer(p)]))
    saveCustomQuery(p, 'Potassium disturbances', [...POTASSIUM_PTS, 'Fatigue'], 'x'); expect(customPotassiumOk(p)).toBe(false)
    saveCustomQuery(p, 'Potassium disturbances', POTASSIUM_PTS, 'x'); expect(customPotassiumOk(p)).toBe(true)
    expect(grade(p)!.score).toBe(100)
  })
})

describe('AI coding assistant', () => {
  test('only the lead switches it on; suggestions include confident wrong ones', () => {
    const p = createProject({ name: 't', studies: ['HLV-204-201', 'RSP-118-302', 'DRM-501-201'], forms: ['AE', 'MH', 'CM'] })
    as(p, 'coder'); expect(() => setAssistant(p, true)).toThrow(/lead/)
    as(p, 'lead'); autoencode(p); setAssistant(p, true)
    const s = assistantStats(p)
    expect(s.shown).toBeGreaterThan(30); expect(s.wrong).toBeGreaterThan(5)
    const wrong = p.records.find((r) => r.suggestion && suggestionRight(p, r) === false && r.suggestion.conf >= 0.9)!
    expect(wrong).toBeTruthy()
    as(p, 'coder'); acceptSuggestion(p, [wrong.id])
    expect(assistantStats(p).acceptedWrong).toBe(1)
    expect(() => rejectSuggestion(p, [p.records.find((r) => r.suggestion && !r.suggestion.decision)!.id], 'no')).toThrow(/why/)
  })
  test('M7 rewards deciding well and penalises automation bias', () => {
    const p = startMission('M7', 'standard'); as(p, 'coder')
    const right = p.records.filter((r) => r.suggestion && suggestionRight(p, r) === true).map((r) => r.id)
    const wrong = p.records.filter((r) => r.suggestion && suggestionRight(p, r) === false).map((r) => r.id)
    acceptSuggestion(p, right); rejectSuggestion(p, wrong, 'Against the conventions.'); solve(p)
    expect(grade(p)!.score).toBe(100)
    const q = startMission('M7', 'standard'); as(q, 'coder')
    acceptSuggestion(q, q.records.filter((r) => r.suggestion).map((r) => r.id)); solve(q)
    expect(grade(q)!.results.find((r) => r.id === 'bias')!.ok).toBe(false)
    void smdOf; void suggestAll
  })
})
