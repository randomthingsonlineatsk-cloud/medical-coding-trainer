import { describe, expect, test } from 'vitest'
import { createProject, autoencode, codeMed, codeDrug, raiseQuery, siteAnswers, approve, sendBack, verdict, stats, consistency, retireSynonym, uncodeBySynonym, approveSynonym, me, smdOf, sddList, BAD_SYNONYMS, type CodingProject, type Role } from '../src/domain/coding'
import { CATALOGUE, itemFor } from '../src/domain/catalogue'
import { SMD_10, SMD_11, ptOf, exactLlt, secondarySocs } from '../src/domain/dictmed'
import { DRUGS, drugsIn } from '../src/domain/dictdrug'
import { impact, applyUpgrade, staleSynonyms } from '../src/domain/upgrade'
import { startMission, grade, solve, submitMission, certificate } from '../src/domain/missions'
import { medCsv, cmCsv, codingReport } from '../src/domain/outputs'

const as = (p: CodingProject, r: Role) => { p.as = p.team.findIndex((m) => m.role === r); return me(p) }
const ALL = ['HLV-204-201', 'RSP-118-302', 'DRM-501-201']
const llt = (name: string) => [...smdOfV('1.0').terms.values()].find((t) => t.level === 'LLT' && t.name === name)!.code
const smdOfV = (v: '1.0' | '1.1') => (v === '1.0' ? SMD_10 : SMD_11)

describe('dictionaries and answer key', () => {
  test('every answer exists in the dictionaries', () => {
    for (const it of CATALOGUE) {
      const a = it.ans as Record<string, string>
      if (a.pt) expect([...SMD_10.terms.values()].some((t) => t.level === 'PT' && t.name === a.pt), it.v).toBe(true)
      if (a.llt) expect(ptOf(SMD_10, (SMD_10.byName.get(a.llt.toLowerCase()) ?? []).find((t) => t.level === 'LLT')!.code)?.name, it.v).toBe(a.pt)
      if (a.ing) expect(DRUGS.find((d) => d.ingredients.join('+') === a.ing)?.atc, it.v).toContain(a.atc)
    }
  })
  test('multiaxial links and the version 1.1 changes', () => {
    const pt = ptOf(SMD_10, exactLlt(SMD_10, 'Shingles')!.code)!
    expect(secondarySocs(SMD_10, pt.code).map((x) => x.name)).toContain('Skin')
    expect(exactLlt(SMD_11, 'Low back ache')).toBeUndefined()
    expect(ptOf(SMD_11, llt('Muscle cramps'))!.name).toBe('Muscle pain')
    expect(drugsIn('Q3').find((d) => d.name === 'Calmadol')!.ingredients).toEqual(['paracetamol', 'caffeine'])
  })
})

describe('autoencoder, coding and queries', () => {
  test('autoencodes exact matches and synonyms; bad synonyms miscode', () => {
    const p = createProject({ name: 't', studies: ALL, forms: ['AE', 'MH', 'CM'] })
    as(p, 'coder'); const r = autoencode(p)
    expect(r.auto + r.synonym).toBeGreaterThan(380)
    expect(r.needClass).toBeGreaterThan(0)
    const wrong = p.records.filter((x) => verdict(p, x).ok === false)
    expect(new Set(wrong.map((x) => x.verbatim.toLowerCase()))).toEqual(new Set(['cold', 'pain', 'dizziness on standing', 'chest infection', 'aspirin']))
  })
  test('roles: a coder codes, a reviewer approves but not their own coding', () => {
    const p = createProject({ name: 't', studies: ['HLV-204-201'], forms: ['AE'] })
    const r = p.records.find((x) => x.verbatim === 'headace')!
    as(p, 'reviewer'); expect(() => codeMed(p, [r.id], llt('Headache'))).toThrow(/coder/)
    as(p, 'coder'); codeMed(p, [r.id], llt('Headache'))
    expect(() => approve(p, [r.id])).toThrow(/reviewer/)
    p.team[1].name = p.team[0].name; as(p, 'reviewer')
    expect(() => approve(p, [r.id])).toThrow(/second person/)
  })
  test('non-current terms and wrong classes are refused', () => {
    const p = createProject({ name: 't', studies: ['HLV-204-201'], forms: ['AE', 'CM'] }); p.smd = '1.1'; as(p, 'coder')
    const r = p.records.find((x) => x.form === 'AE')!
    expect(() => codeMed(p, [r.id], llt('Head ache'))).toThrow(/not current/)
    const c = p.records.find((x) => x.form === 'CM' && x.verbatim === 'Aspirin')!
    const asp = sddList(p).find((d) => d.name === 'Aspirin')!
    expect(() => codeDrug(p, [c.id], asp.id, 'F10AA')).toThrow(/not one of/)
  })
  test('queries: a split creates new records; an unnecessary query comes back', () => {
    const p = createProject({ name: 't', studies: ['HLV-204-201'], forms: ['AE'] }); as(p, 'coder')
    const split = p.records.find((x) => x.verbatim === 'Headache and nausea')!
    const fine = p.records.find((x) => x.verbatim === 'headace')!
    raiseQuery(p, [split.id], 'split', 'Please record each event separately.')
    raiseQuery(p, [fine.id], 'clarify', 'Please confirm the term written here.')
    siteAnswers(p)
    expect(split.status).toBe('replaced')
    expect(p.records.filter((x) => x.parent === split.id).map((x) => x.verbatim)).toEqual(['Headache', 'Nausea'])
    expect(fine.status).toBe('uncoded'); expect(stats(p).unnecessary).toBe(1)
    expect(verdict(p, split).ok).toBe(true)
  })
  test('choosing the class by indication', () => {
    const p = createProject({ name: 't', studies: ['HLV-204-201'], forms: ['CM'] }); as(p, 'coder')
    const prev = p.records.find((x) => x.verbatim === 'Aspirin' && x.ind === 'Prevention of heart attack')!
    const asp = sddList(p).find((d) => d.name === 'Aspirin')!
    codeDrug(p, [prev.id], asp.id, 'K02BA'); expect(verdict(p, prev).ok).toBe(false)
    codeDrug(p, [prev.id], asp.id, 'W01AC'); expect(verdict(p, prev).ok).toBe(true)
  })
  test('consistency report and send back', () => {
    const p = createProject({ name: 't', studies: ['HLV-204-201'], forms: ['AE'] }); as(p, 'coder')
    const rs = p.records.filter((x) => x.verbatim === 'Dizziness')
    codeMed(p, [rs[0].id], llt('Dizziness')); codeMed(p, [rs[1].id], llt('Vertigo'))
    expect(consistency(p).length).toBe(1)
    as(p, 'reviewer'); sendBack(p, rs[1].id, 'Dizziness is not vertigo.'); expect(rs[1].status).toBe('uncoded')
  })
})

describe('synonym lists', () => {
  test('retiring a bad synonym and re-opening what it coded', () => {
    const p = startMission('M3', 'standard')
    as(p, 'lead')
    for (const s of p.synonyms.filter((x) => BAD_SYNONYMS[x.verbatim])) { retireSynonym(p, s.id, 'Should not be on the list.'); uncodeBySynonym(p, s.id) }
    expect(p.records.filter((x) => verdict(p, x).ok === false)).toEqual([])
    solve(p)
    as(p, 'coder')
    const r = p.records.find((x) => x.verbatim === 'tierd')!
    // propose three study synonyms by coding with the box ticked, approve as the reviewer
    for (const v of ['tierd', 'dizzyness', 'headace']) { const x = p.records.find((y) => y.verbatim === v)!; codeMed(p, [x.id], llt(v === 'tierd' ? 'Tired' : v === 'dizzyness' ? 'Dizziness' : 'Headache'), true) }
    as(p, 'reviewer')
    for (const s of p.synonyms.filter((x) => x.status === 'proposed')) approveSynonym(p, s.id)
    approve(p, p.records.filter((x) => x.status === 'coded').map((x) => x.id))
    void r
    const g = grade(p)!
    expect(g.results.filter((x) => !x.ok).map((x) => x.id)).toEqual([])
  })
  test('a proposer cannot approve their own synonym', () => {
    const p = createProject({ name: 't', studies: ['HLV-204-201'], forms: ['AE'] }); as(p, 'coder')
    const x = p.records.find((y) => y.verbatim === 'headace')!; codeMed(p, [x.id], llt('Headache'), true)
    p.team[1].name = p.team[0].name; as(p, 'reviewer')
    expect(() => approveSynonym(p, p.synonyms.find((s) => s.status === 'proposed')!.id)).toThrow(/second person/)
  })
})

describe('upversioning (mission M4)', () => {
  test('impact, upgrade, recode, query, re-approve: 100', () => {
    const p = startMission('M4', 'standard')
    const im = impact(p)
    const kinds = new Set(im.rows.map((r) => r.kind))
    for (const k of ['recode', 'pt-changed', 'soc-moved', 'class-changed', 'name-changed']) expect(kinds.has(k as never), k).toBe(true)
    expect(im.synonyms.map((s) => s.verbatim)).toContain('dizzy spells')
    as(p, 'lead'); expect(() => applyUpgrade(p, { name: me(p).name, role: 'Coding lead', meaning: 'x' }, 'Upgrade before pooling for the integrated safety summary.')).toThrow(/impact/)
    p.reviewedImpact = true
    applyUpgrade(p, { name: me(p).name, role: 'Coding lead', meaning: 'x' }, 'Upgrade before pooling for the integrated safety summary.')
    expect(p.smd).toBe('1.1')
    as(p, 'coder')
    for (const r of p.records.filter((x) => x.trail[0]?.what.includes('"Calmadol"'))) raiseQuery(p, [r.id], 'clarify', 'Which product: paracetamol, or paracetamol with caffeine?')
    solve(p)
    as(p, 'lead'); for (const s of staleSynonyms(p)) retireSynonym(p, s.id, 'Points to a retired term.')
    expect(grade(p)!.results.filter((x) => !x.ok).map((x) => x.id)).toEqual([])
    expect(grade(p)!.score).toBe(100)
  })
})

describe('missions, outputs, certificate', () => {
  test('M1, M2 and M5 can reach a pass', () => {
    for (const id of ['M1', 'M2', 'M5']) {
      const p = startMission(id, 'guided')
      as(p, 'lead'); for (const s of p.synonyms.filter((x) => BAD_SYNONYMS[x.verbatim])) retireSynonym(p, s.id, 'Should not be on the list.')
      solve(p)
      expect(grade(p)!.score, id).toBe(100)
      expect(submitMission(p).passed).toBe(true)
    }
  })
  test('outputs carry the SDTM coded variables', () => {
    const p = startMission('M5', 'guided'); solve(p)
    const ae = medCsv(p, 'AE').split('\r\n')
    expect(ae[0]).toContain('"AEDECOD","AEPTCD"'); expect(ae[0]).toContain('"AEBODSYS"')
    expect(ae.some((l) => l.includes('"Headache","') && l.includes('"Head pain"'))).toBe(true)
    expect(cmCsv(p).split('\r\n')[0]).toContain('"CMCLASCD"')
    expect(codingReport(p)).toContain('Coding queries')
    const it = itemFor('HLV-204-201', 'CM', 'Aspirin', 'Prevention of heart attack')!; expect(it.ans).toMatchObject({ atc: 'W01AC' })
    void smdOf
  })
  test('certificate code', () => {
    const ps = ['M1', 'M2', 'M3', 'M4', 'M5'].map((id) => { const p = createProject({ name: id, studies: ['HLV-204-201'], forms: ['AE'] }); p.mission = { id, level: 'expert', startedUtc: 'x', endedUtc: '2026-11-10T00:00:00Z', score: 90 }; return p })
    const c = certificate(ps, 'L-1', 'Test Learner')
    expect(c.eligible).toBe(true); expect(c.code).toMatch(/^MCT-[0-9A-F]{5}-[0-9A-F]{5}$/); expect(c.distinction).toBe(true)
    expect(certificate(ps.slice(1), 'L-1', 'Test Learner').eligible).toBe(false)
  })
})
