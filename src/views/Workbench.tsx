import { useState } from 'react'
import { useStore } from '../state'
import { autoencode, siteAnswers, codeMed, codeDrug, raiseQuery, verdict, label, smdOf, sddList, me, stats, type Rec, type CodingProject } from '../domain/coding'
import { searchMed, path } from '../domain/dictmed'
import { atcByCode } from '../domain/dictdrug'
import { norm } from '../domain/catalogue'
import { Btn, Panel, Pill, Select, Stat, Table, TextArea, ic } from './ui'

type Filter = 'todo' | 'query' | 'coded' | 'approved' | 'all'
const STATUS_TONE: Record<string, 'grey' | 'amber' | 'green' | 'blue' | 'purple' | 'red'> = { uncoded: 'amber', coded: 'blue', approved: 'green', query: 'purple', replaced: 'grey', removed: 'grey' }
export const showVerdicts = (p: CodingProject) => !p.mission || p.mission.level === 'guided' || !!p.mission.endedUtc
const groupKey = (r: Rec) => `${r.form}|${norm(r.verbatim)}${r.form === 'CM' ? `|${norm(r.ind ?? '')}` : ''}`

// The coding workbench: verbatims grouped as the coder sees them, with the dictionary search.
export default function Workbench() {
  const { p, act } = useStore()
  const [filter, setFilter] = useState<Filter>('todo')
  const [form, setForm] = useState('')
  const [study, setStudy] = useState('')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState('')
  const s = stats(p!)
  const groups = (() => {
    const m = new Map<string, Rec[]>()
    for (const r of p!.records) {
      if (['replaced', 'removed'].includes(r.status) && filter !== 'all') continue
      if (filter === 'todo' && r.status !== 'uncoded') continue
      if (filter === 'query' && r.status !== 'query') continue
      if (filter === 'coded' && r.status !== 'coded') continue
      if (filter === 'approved' && r.status !== 'approved') continue
      if (form && (form === 'MED' ? r.form === 'CM' : r.form !== form)) continue
      if (study && r.study !== study) continue
      if (q && !norm(r.verbatim).includes(norm(q))) continue
      const k = groupKey(r); m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  })()
  const cur = groups.find(([k]) => k === sel) ?? groups[0]
  return (
    <div className="space-y-4">
      <Panel title="Coding workbench" sub="The autoencoder codes verbatims that match a current dictionary term or an approved synonym exactly. You code the rest, or query the site when a term cannot be coded as written."
        right={<div className="flex gap-2"><Btn tone="solid" onClick={() => act((x) => { autoencode(x) })}>Run the autoencoder</Btn><Btn tone="grey" disabled={!s.queries} onClick={() => act((x) => { siteAnswers(x) })}>Receive site answers ({s.queries})</Btn></div>}>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <Stat label="Records" value={s.total} /><Stat label="To code" value={s.uncoded} tone={s.uncoded ? 'amber' : 'green'} /><Stat label="Autoencoded" value={s.auto} /><Stat label="By synonym" value={s.synonym} />
          <Stat label="Manual" value={s.manual} /><Stat label="Approved" value={s.approved} tone={s.approved === s.total ? 'green' : 'grey'} />
        </div>
      </Panel>
      <div className="grid lg:grid-cols-[22rem_1fr] gap-4">
        <Panel title={`Verbatims (${groups.length} groups)`}>
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="Status" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} options={[{ value: 'todo', label: 'To code' }, { value: 'query', label: 'Open queries' }, { value: 'coded', label: 'Coded, to approve' }, { value: 'approved', label: 'Approved' }, { value: 'all', label: 'All' }]} />
            <Select aria-label="Form" value={form} onChange={(e) => setForm(e.target.value)} options={[{ value: '', label: 'All forms' }, { value: 'MED', label: 'AE and MH' }, { value: 'AE', label: 'Adverse events' }, { value: 'MH', label: 'Medical history' }, { value: 'CM', label: 'Medications' }]} />
            <Select aria-label="Study" value={study} onChange={(e) => setStudy(e.target.value)} options={[{ value: '', label: 'All studies' }, ...p!.studies.map((x) => ({ value: x, label: x }))]} />
            <input aria-label="Search verbatims" className={ic('')} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <ul className="max-h-[34rem] overflow-y-auto space-y-0.5">
            {groups.map(([k, rs]) => (
              <li key={k}><button onClick={() => setSel(k)} aria-current={cur?.[0] === k ? 'true' : undefined} className={`w-full text-left px-2 py-1 rounded text-xs ${cur?.[0] === k ? 'bg-lab-fda-soft text-lab-fda' : 'hover:bg-lab-panel-strong'}`}>
                <span className="font-mono text-[10px] text-lab-text-muted mr-1">{rs[0].form}</span>{rs[0].verbatim}{rs[0].form === 'CM' && <span className="text-lab-text-muted"> · {rs[0].ind}</span>}
                <span className="float-right text-lab-text-muted">{rs.length}{rs.some((r) => r.flags?.length) ? ' ⚑' : ''}</span>
              </button></li>
            ))}
            {!groups.length && <li className="text-xs text-lab-text-muted px-2">Nothing here.</li>}
          </ul>
        </Panel>
        {cur ? <Group key={cur[0]} rs={cur[1]} /> : <Panel title="Nothing selected"><p className="text-sm text-lab-text-muted">Pick a verbatim.</p></Panel>}
      </div>
    </div>
  )
}

function Group({ rs }: { rs: Rec[] }) {
  const { p } = useStore()
  const first = rs[0], med = first.form !== 'CM'
  const open = rs.filter((r) => ['uncoded', 'coded'].includes(r.status))
  const [ids, setIds] = useState<string[]>(open.map((r) => r.id))
  const [trail, setTrail] = useState('')
  const show = showVerdicts(p!)
  return (
    <div className="space-y-3">
      <Panel title={`"${first.verbatim}"`} sub={`${first.form === 'AE' ? 'Adverse event' : first.form === 'MH' ? 'Medical history' : 'Concomitant medication'}${first.ind ? `, indication "${first.ind}"` : ''} · ${rs.length} record${rs.length > 1 ? 's' : ''}`}>
        <Table head={['', 'Record', 'Study / subject', 'Status', 'Coding', show ? 'Check' : '', '']} rows={rs.map((r) => {
          const v = show ? verdict(p!, r) : null
          return [
            <input type="checkbox" aria-label={`Select ${r.id}`} disabled={!['uncoded', 'coded'].includes(r.status)} checked={ids.includes(r.id)} onChange={(e) => setIds(e.target.checked ? [...ids, r.id] : ids.filter((x) => x !== r.id))} />,
            <span className="font-mono">{r.id}</span>, `${r.study} ${r.subj}`,
            <span><Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>{r.method && <span className="block text-[10px] text-lab-text-muted">{r.method}{r.by ? `, ${r.by}` : ''}{r.reviewedBy ? `; approved ${r.reviewedBy}` : ''}</span>}</span>,
            <span className="text-[11px]">{r.code ? label(p!, r) : r.query ? `Query: ${r.query.text}${r.query.answer ? ` → ${r.query.answer}` : ''}` : ''}{r.flags?.map((f) => <span key={f} className="block text-lab-amber">⚑ {f}</span>)}</span>,
            v && v.ok !== undefined ? <span className={`text-[11px] ${v.ok ? (v.llt === false ? 'text-lab-amber' : 'text-lab-cdsco') : 'text-lab-red'}`}>{v.why}</span> : '',
            <Btn tone="grey" onClick={() => setTrail(trail === r.id ? '' : r.id)}>Trail</Btn>,
          ]
        })} />
        {trail && <ul className="text-[11px] text-lab-text-muted list-disc ml-5">{rs.find((r) => r.id === trail)?.trail.map((t, i) => <li key={i}>{t.utc.slice(0, 16).replace('T', ' ')} · {t.by}: {t.what}</li>)}</ul>}
        <p className="text-[11px] text-lab-text-muted">{ids.length} selected. Actions below apply to the selected records.</p>
      </Panel>
      {open.length > 0 && (med ? <MedSearch ids={ids} verbatim={first.verbatim} /> : <DrugSearch ids={ids} verbatim={first.verbatim} ind={first.ind ?? ''} />)}
      {open.length > 0 && <QueryBox ids={ids} med={med} />}
      {me(p!).role !== 'coder' && open.length > 0 && <p className="text-xs text-lab-text-muted">Coding and queries are for the coder: switch roles in the header.</p>}
    </div>
  )
}

function MedSearch({ ids, verbatim }: { ids: string[]; verbatim: string }) {
  const { p, act } = useStore()
  const [q, setQ] = useState(verbatim.replace(/[^\p{L}\s-]/gu, ' ').trim())
  const [pick, setPick] = useState('')
  const [syn, setSyn] = useState(false)
  const d = smdOf(p!)
  const res = searchMed(d, q, 40)
  return (
    <Panel title={`Medical dictionary search (SMD ${p!.smd})`} sub="Search the lowest-level terms. Each shows its preferred term and primary system class. Non-current terms are shown but cannot be selected.">
      <input aria-label="Search the medical dictionary" className={ic('')} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="max-h-72 overflow-y-auto divide-y divide-lab-line/50">
        {res.map((t) => {
          const pth = path(d, t.code)
          return (
            <li key={t.code}><label className={`flex gap-2 items-start px-1 py-1 text-xs ${t.current ? '' : 'opacity-50'}`}>
              <input type="radio" name="llt" disabled={!t.current} checked={pick === t.code} onChange={() => setPick(t.code)} className="mt-0.5" />
              <span><b>{t.name}</b> <span className="font-mono text-[10px] text-lab-text-muted">{t.code}</span>{!t.current && <Pill className="ml-1">not current</Pill>}
                <span className="block text-lab-text-muted">PT {pth[3]?.name} · HLT {pth[2]?.name} · SOC {pth[0]?.name}</span></span>
            </label></li>
          )
        })}
        {!res.length && <li className="text-xs text-lab-text-muted py-1">No lowest-level term contains every word. Try fewer words, or another word for the same thing.</li>}
      </ul>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={syn} onChange={(e) => setSyn(e.target.checked)} /> Propose "{norm(verbatim)}" as a study synonym for this term (a reviewer approves it)</label>
      <Btn tone="solid" disabled={!pick || !ids.length} onClick={() => { if (act((x) => codeMed(x, ids, pick, syn))) setPick('') }}>Code {ids.length} record{ids.length === 1 ? '' : 's'}</Btn>
    </Panel>
  )
}

function DrugSearch({ ids, verbatim, ind }: { ids: string[]; verbatim: string; ind: string }) {
  const { p, act } = useStore()
  const [q, setQ] = useState(verbatim.split(/\s+/)[0])
  const [pick, setPick] = useState('')
  const [atc, setAtc] = useState('')
  const [syn, setSyn] = useState(false)
  const list = sddList(p!)
  const s = q.trim().toLowerCase()
  const res = s.length < 2 ? [] : list.filter((d) => d.name.toLowerCase().includes(s) || d.ingredients.some((x) => x.includes(s))).slice(0, 40)
  const rec = list.find((d) => d.id === pick)
  return (
    <Panel title="Drug dictionary search" sub={`Records by name or ingredient. Sequence 2 = 001 is the ingredient name; other numbers are trade names. Indication: "${ind}".`}>
      <input aria-label="Search the drug dictionary" className={ic('')} value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="max-h-60 overflow-y-auto divide-y divide-lab-line/50">
        {res.map((d) => (
          <li key={d.id}><label className="flex gap-2 items-start px-1 py-1 text-xs">
            <input type="radio" name="drug" checked={pick === d.id} onChange={() => { setPick(d.id); setAtc(d.atc.length === 1 ? d.atc[0] : '') }} className="mt-0.5" />
            <span><b>{d.name}</b> {!d.generic && <Pill className="ml-1">trade name</Pill>} <span className="font-mono text-[10px] text-lab-text-muted">{d.id}</span>
              <span className="block text-lab-text-muted">{d.ingredients.join(' + ')} · {d.atc.map((a) => `${a} ${atcByCode.get(a)?.name ?? ''}`).join(' | ')}</span></span>
          </label></li>
        ))}
        {s.length >= 2 && !res.length && <li className="text-xs text-lab-text-muted py-1">No record. Try the ingredient name.</li>}
      </ul>
      {rec && rec.atc.length > 1 && (
        <fieldset className="text-xs space-y-1"><legend className="text-lab-text">This record has {rec.atc.length} classes: choose by indication and route (CC-25)</legend>
          {rec.atc.map((a) => <label key={a} className="flex gap-2"><input type="radio" name="atc" checked={atc === a} onChange={() => setAtc(a)} /> {a} {atcByCode.get(a)?.name}</label>)}
        </fieldset>
      )}
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={syn} onChange={(e) => setSyn(e.target.checked)} /> Propose "{norm(verbatim)}" as a study synonym for this record</label>
      <Btn tone="solid" disabled={!pick || !atc || !ids.length} onClick={() => { if (act((x) => codeDrug(x, ids, pick, atc, syn))) setPick('') }}>Code {ids.length} record{ids.length === 1 ? '' : 's'}</Btn>
    </Panel>
  )
}

function QueryBox({ ids, med }: { ids: string[]; med: boolean }) {
  const { act } = useStore()
  const [kind, setKind] = useState<'split' | 'clarify' | 'not-drug'>('clarify')
  const TEMPL = { clarify: med ? 'The term is unclear and cannot be coded as written. Please give a more specific term (for example, the site of the pain or the diagnosis).' : 'Please give the name of the product the participant took.', split: 'This entry describes more than one event. Please record each event as its own adverse event, with its own dates, severity and causality.', 'not-drug': 'This is not a medicinal product. Please record it on the procedures page and delete it from the medications page.' }
  const [text, setText] = useState(TEMPL.clarify)
  return (
    <Panel title="Query the site" sub="When a term cannot be coded without guessing. The site's answer returns the record to the queue with the new term.">
      <div className="grid sm:grid-cols-[12rem_1fr] gap-2">
        <Select aria-label="Query type" value={kind} onChange={(e) => { const k = e.target.value as typeof kind; setKind(k); setText(TEMPL[k]) }} options={[{ value: 'clarify', label: 'Clarify the term' }, ...(med ? [{ value: 'split', label: 'Split into separate events' }] : [{ value: 'not-drug', label: 'Not a medication' }])]} />
        <TextArea aria-label="Query text" className="min-h-14" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <Btn tone="grey" disabled={!ids.length} onClick={() => act((x) => raiseQuery(x, ids, kind, text))}>Raise the query on {ids.length} record{ids.length === 1 ? '' : 's'}</Btn>
    </Panel>
  )
}
