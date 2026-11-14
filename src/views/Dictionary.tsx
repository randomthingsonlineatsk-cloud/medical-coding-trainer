import { useState } from 'react'
import { useStore } from '../state'
import { SMD, path, secondarySocs, medStats, V11_CHANGES, TRANSLATIONS, LANG_NAME, type Term, type Lang } from '../domain/dictmed'
import { ATC_CLASSES, atcByCode, SDD_Q3_CHANGES, drugsIn } from '../domain/dictdrug'
import { sddName } from '../domain/coding'
import { Panel, Pill, Table, Tabs, ic } from './ui'

// The two training dictionaries: browse the hierarchy, see multiaxial links and versions.
export default function Dictionary() {
  const { p } = useStore()
  const [tab, setTab] = useState<'smd' | 'sdd'>('smd')
  return (
    <div className="space-y-4">
      <Tabs tabs={[{ id: 'smd', label: `Medical dictionary (SMD ${p!.smd})` }, { id: 'sdd', label: `Drug dictionary (${sddName(p!.sdd)})` }]} value={tab} onChange={setTab} />
      {tab === 'smd' ? <Smd /> : <Sdd />}
    </div>
  )
}

function Smd() {
  const { p } = useStore()
  const d = SMD[p!.smd]
  const c = medStats(d)
  const [open, setOpen] = useState<string[]>([])
  const [q, setQ] = useState('')
  const kids = (code?: string) => [...d.terms.values()].filter((t) => t.parent === code && (t.level !== 'LLT' || true)).sort((a, b) => a.name.localeCompare(b.name))
  const toggle = (code: string) => setOpen(open.includes(code) ? open.filter((x) => x !== code) : [...open, code])
  const hits = q.trim().length >= 2 ? [...d.terms.values()].filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60) : []
  const Node = ({ t }: { t: Term }) => {
    const ch = t.level === 'LLT' ? [] : kids(t.code)
    const sec = t.level === 'PT' ? secondarySocs(d, t.code) : []
    return (
      <li>
        <button className={`text-left text-xs ${t.level === 'LLT' ? (t.current ? 'text-lab-text' : 'text-lab-text-muted line-through') : 'text-lab-text'} hover:underline`} onClick={() => ch.length && toggle(t.code)}>
          {ch.length ? (open.includes(t.code) ? '▾ ' : '▸ ') : '· '}<span className="font-mono text-[10px] text-lab-text-muted mr-1">{t.level}</span>{t.name} <span className="font-mono text-[10px] text-lab-text-muted">{t.code}</span>
          {sec.length > 0 && <span className="text-lab-purple"> · also in {sec.map((x) => x.name).join(', ')}</span>}
        </button>
        {open.includes(t.code) && <ul className="ml-4 border-l border-lab-line pl-2 space-y-0.5">{ch.map((x) => <Node key={x.code} t={x} />)}</ul>}
      </li>
    )
  }
  return (
    <div className="space-y-4">
      <Panel title={`Study Medical Dictionary ${d.version} (released ${d.released})`} sub="A fictional terminology with MedDRA's five levels: system organ class (SOC), high-level group term (HLGT), high-level term (HLT), preferred term (PT) and lowest-level term (LLT). You code to an LLT; analyses count PTs and SOCs. Every PT has one primary SOC and may be linked to others (multiaxiality). Names, codes and hierarchy are invented; no MedDRA content is used.">
        <div className="flex flex-wrap gap-2">{(Object.keys(c) as (keyof typeof c)[]).map((k) => <Pill key={k}>{c[k]} {k}</Pill>)}</div>
        <input aria-label="Search all levels" className={ic('')} placeholder="Search terms at every level" value={q} onChange={(e) => setQ(e.target.value)} />
        {hits.length > 0 && <Table head={['Level', 'Term', 'Code', 'Path', 'Current']} rows={hits.map((t) => [t.level, t.name, <span className="font-mono">{t.code}</span>, <span className="text-lab-text-muted">{path(d, t.code).slice(0, -1).map((x) => x.name).join(' › ')}</span>, t.current ? 'Yes' : <Pill tone="red">No</Pill>])} />}
      </Panel>
      <Panel title="Hierarchy"><ul className="space-y-0.5">{kids(undefined).map((t) => <Node key={t.code} t={t} />)}</ul></Panel>
      <Panel title="Language versions" sub="Each LLT has the same code in every language version, so a term coded in Japanese and one coded in English count together. The training versions cover the commonest terms only.">
        <Table head={['LLT (English)', ...(Object.keys(LANG_NAME) as Lang[]).map((l) => LANG_NAME[l])]} rows={Object.entries(TRANSLATIONS).map(([en, tr]) => [en, ...(Object.keys(LANG_NAME) as Lang[]).map((l) => tr[l] ?? '')])} />
      </Panel>
      <Panel title="What version 1.1 changes" sub="Released twice a year, a dictionary version retires terms, adds terms and moves terms in the hierarchy.">
        <Table head={['Change', 'Term', 'Note']} rows={V11_CHANGES.map((x) => [x.kind, 'llt' in x ? x.llt : x.pt, x.note])} />
      </Panel>
    </div>
  )
}

function Sdd() {
  const { p } = useStore()
  const list = drugsIn(p!.sdd)
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const shown = s ? list.filter((d) => d.name.toLowerCase().includes(s) || d.ingredients.some((x) => x.includes(s)) || d.atc.some((a) => a.toLowerCase().startsWith(s))) : list.slice(0, 80)
  return (
    <div className="space-y-4">
      <Panel title={sddName(p!.sdd)} sub="A fictional drug dictionary with the record structure of WHODrug Global in its B3 format: a drug record number, sequence 1 for the active moiety or salt, sequence 2 for the name (001 = ingredient, others = trade names), and four-level classes shaped like ATC. Ingredient names are public INNs; record numbers, trade names and class codes are invented, and the class letters are ones the real ATC does not use.">
        <input aria-label="Search drugs" className={ic('')} placeholder="Name, ingredient or class code" value={q} onChange={(e) => setQ(e.target.value)} />
        <Table head={['Record', 'Name', 'Type', 'Ingredients', 'Classes']} rows={shown.map((d) => [<span className="font-mono">{d.id}</span>, d.name, d.generic ? 'Ingredient' : 'Trade name', d.ingredients.join(' + '), d.atc.map((a) => `${a} ${atcByCode.get(a)?.name ?? ''}`).join(' | ')])} />
        {!s && <p className="text-xs text-lab-text-muted">First 80 of {list.length} records. Search to see the rest.</p>}
      </Panel>
      <Panel title="Classes">
        <Table head={['Code', 'Level', 'Name']} rows={ATC_CLASSES.filter((a) => a.level <= 2 || a.level === 4).sort((a, b) => a.code.localeCompare(b.code)).map((a) => [<span className="font-mono">{a.code}</span>, a.level, a.name])} />
      </Panel>
      <Panel title="What SDD 2026 Q3 changes"><Table head={['Change', 'Note']} rows={SDD_Q3_CHANGES.map((x) => [x.kind, x.note])} /></Panel>
    </div>
  )
}
