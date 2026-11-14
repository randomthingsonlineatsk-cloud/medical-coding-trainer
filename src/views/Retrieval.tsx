import { useState } from 'react'
import { useStore } from '../state'
import { GROUPS, QUESTIONS, runGroup, runPts, bySoc, saveCustomQuery } from '../domain/retrieval'
import { smdOf, me } from '../domain/coding'
import { Btn, Panel, Pill, Select, Stat, Table, ic } from './ui'

// Getting the coded events back out: standard search groups, system-class counts and custom queries.
export default function Retrieval() {
  const { p, act } = useStore()
  const [g, setG] = useState(GROUPS[0].id)
  const [scope, setScope] = useState<'narrow' | 'broad'>('narrow')
  const [study, setStudy] = useState('')
  const [soc, setSoc] = useState('Infections')
  const [sec, setSec] = useState(false)
  const [name, setName] = useState('')
  const [pts, setPts] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const grp = GROUPS.find((x) => x.id === g)!
  const studies = study ? [study] : undefined
  const r = runGroup(p!, grp, scope, studies)
  const d = smdOf(p!)
  const socs = [...d.terms.values()].filter((t) => t.level === 'SOC').map((t) => t.name).sort()
  const allPts = [...d.terms.values()].filter((t) => t.level === 'PT').map((t) => t.name).sort()
  const sc = bySoc(p!, soc, sec, studies)
  const sc1 = bySoc(p!, soc, false, studies)
  const isM6 = p!.mission?.id === 'M6'
  return (
    <div className="space-y-4">
      <Panel title="Retrieving coded events" sub="Safety review needs every case of a concept, whatever words the sites used and whichever preferred term the coder chose. MedDRA provides Standardised MedDRA Queries for this; the training dictionary has Standard Search Groups built the same way (invented, not SMQ content): a narrow scope of terms very likely to mean the concept, and a broad scope that adds terms that may. ICH's Data Retrieval and Presentation: Points to Consider covers their use.">
        <Select aria-label="Study" className="max-w-xs" value={study} onChange={(e) => setStudy(e.target.value)} options={[{ value: '', label: 'All studies in the project' }, ...p!.studies.map((x) => ({ value: x, label: x }))]} />
      </Panel>
      <Panel title="Standard search groups">
        <div className="grid sm:grid-cols-[1fr_12rem] gap-2">
          <Select aria-label="Search group" value={g} onChange={(e) => setG(e.target.value)} options={GROUPS.map((x) => ({ value: x.id, label: `${x.id} ${x.name}` }))} />
          <Select aria-label="Scope" value={scope} onChange={(e) => setScope(e.target.value as 'narrow' | 'broad')} options={[{ value: 'narrow', label: 'Narrow scope' }, { value: 'broad', label: 'Broad scope' }]} />
        </div>
        <p className="text-xs text-lab-text-muted">Narrow: {grp.narrow.join(', ')}. {grp.broad.length ? `Broad adds: ${grp.broad.join(', ')}.` : ''} {grp.note}</p>
        <div className="grid grid-cols-2 gap-2 max-w-md"><Stat label="Records" value={r.records.length} /><Stat label="Participants" value={r.participants} /></div>
        <Table head={['Preferred term', 'Records', 'Scope']} rows={r.byPt.map(([pt, n]) => [pt, n, grp.narrow.includes(pt) ? 'narrow' : <Pill tone="amber">broad only</Pill>])} empty="No coded events in this group." />
      </Panel>
      <Panel title="By system class: primary only, or with secondary links" sub="Incidence tables count each event once, under its PT's primary system class. A search for everything in a class should also use secondary links, or it misses events that tables show elsewhere (shingles is an infection that also belongs under skin).">
        <div className="flex flex-wrap gap-2 items-center">
          <Select aria-label="System class" className="max-w-xs" value={soc} onChange={(e) => setSoc(e.target.value)} options={socs.map((x) => ({ value: x, label: x }))} />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={sec} onChange={(e) => setSec(e.target.checked)} /> Include secondary links</label>
        </div>
        <p className="text-sm text-lab-text">{sc.records.length} records, {sc.participants} participants{sec ? ` (primary only: ${sc1.records.length})` : ''}.</p>
      </Panel>
      <Panel title="Custom queries" sub="When no standard group fits, build a custom query: a named list of preferred terms, reviewed by a physician and documented with the analysis.">
        <div className="grid sm:grid-cols-[16rem_1fr] gap-2">
          <input aria-label="Query name" className={ic('')} placeholder="Name, e.g. Potassium disturbances" value={name} onChange={(e) => setName(e.target.value)} />
          <input aria-label="Filter terms" className={ic('')} placeholder="Filter the preferred terms" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-3 gap-x-4 max-h-56 overflow-y-auto">
          {allPts.filter((x) => !filter || x.toLowerCase().includes(filter.toLowerCase())).map((x) => <label key={x} className="flex gap-2 text-xs"><input type="checkbox" checked={pts.includes(x)} onChange={() => setPts(pts.includes(x) ? pts.filter((y) => y !== x) : [...pts, x])} /> {x}</label>)}
        </div>
        <Btn tone="solid" disabled={!name.trim() || !pts.length} onClick={() => act((x) => saveCustomQuery(x, name, pts, me(x).name))}>Save the query ({pts.length} terms)</Btn>
        <Table head={['Query', 'Preferred terms', 'Records', 'Participants', '']} empty="No custom queries yet." rows={(p!.customQueries ?? []).map((q) => { const rr = runPts(p!, q.pts, studies); return [q.name, <span className="text-[11px]">{q.pts.join(', ')}</span>, rr.records.length, rr.participants, <Btn tone="grey" onClick={() => { setName(q.name); setPts(q.pts) }}>Edit</Btn>] })} />
      </Panel>
      {isM6 && (
        <Panel title="The safety physician's questions" sub="Answer with a number. Use the tools above; the study filter applies to them.">
          {QUESTIONS.map((q) => (
            <label key={q.id} className="grid sm:grid-cols-[1fr_8rem] gap-2 items-center text-xs text-lab-text">
              <span><span className="font-mono text-lab-text-muted mr-1">{q.id}</span>{q.text}</span>
              <input aria-label={`Answer ${q.id}`} className={ic('')} value={p!.answers?.[q.id] ?? ''} onChange={(e) => act((x) => { x.answers = { ...(x.answers ?? {}), [q.id]: e.target.value } })} />
            </label>
          ))}
        </Panel>
      )}
    </div>
  )
}
