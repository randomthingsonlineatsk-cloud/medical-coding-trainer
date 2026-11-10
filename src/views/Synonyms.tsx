import { useState } from 'react'
import { useStore } from '../state'
import { approveSynonym, retireSynonym, uncodeBySynonym, codedBySynonym, smdOf, drugRec, me, type Synonym } from '../domain/coding'
import { ptOf } from '../domain/dictmed'
import { staleSynonyms } from '../domain/upgrade'
import { Btn, Panel, Pill, Table, TextArea } from './ui'

// Synonym lists: verbatim-to-term mappings the autoencoder uses. A company list applies to every
// study; a study list to one. Every entry is approved by a second person.
export default function Synonyms() {
  const { p } = useStore()
  const stale = staleSynonyms(p!)
  const target = (s: Synonym) => {
    if (s.dict === 'SDD') { const d = drugRec(p!.sdd, s.code); return `${d?.name ?? s.code} (${d?.ingredients.join(' + ')})${s.atc ? `, class fixed to ${s.atc}` : ''}` }
    const d = smdOf(p!), t = d.terms.get(s.code)
    return t ? `LLT ${t.name} → PT ${ptOf(d, t.code)?.name}${t.current ? '' : ' (not current)'}` : s.code
  }
  const rows = (list: Synonym[]) => list.map((s) => [
    <span className="font-mono">"{s.verbatim}"</span>, s.dict, target(s), s.scope === 'company' ? 'Company' : s.scope,
    <Pill tone={s.status === 'approved' ? 'green' : s.status === 'proposed' ? 'amber' : 'grey'}>{s.status}</Pill>,
    <span className="text-[11px]">{s.by}{s.approvedBy ? `; approved ${s.approvedBy}` : ''}{s.note ? <span className="block text-lab-amber">{s.note}</span> : null}</span>,
    codedBySynonym(p!, s).length, <Actions s={s} />,
  ])
  const head = ['Verbatim', 'Dictionary', 'Maps to', 'Scope', 'Status', 'Who', 'Records coded by it', '']
  return (
    <div className="space-y-4">
      <Panel title="How synonym lists work" sub="A synonym maps a verbatim the dictionary does not contain to a term. The autoencoder applies approved synonyms to every matching record, so a wrong one miscodes at scale and silently. A good synonym is a spelling, abbreviation or wording with one clear meaning. A vague term, an added diagnosis or a fixed drug class does not belong on a list: those need a coder's judgement or a query.">
        {stale.length > 0 && <p className="text-xs text-lab-amber">{stale.length} synonym(s) point to terms retired in SMD {p!.smd}: retire them and propose a new one for the current term.</p>}
        <p className="text-xs text-lab-text-muted">Retiring a synonym stops future autoencoding; it does not recode what it already coded. Use "Re-open its records" to send those records back to the queue. You are {me(p!).name}: proposals come from coding with "propose as a study synonym"; approval needs a different person.</p>
      </Panel>
      <Panel title={`Company synonym list (${p!.synonyms.filter((s) => s.scope === 'company').length})`}><Table head={head} rows={rows(p!.synonyms.filter((s) => s.scope === 'company'))} /></Panel>
      <Panel title={`Study synonym lists (${p!.synonyms.filter((s) => s.scope !== 'company').length})`}><Table head={head} empty="No study synonyms yet." rows={rows(p!.synonyms.filter((s) => s.scope !== 'company'))} /></Panel>
    </div>
  )
}

function Actions({ s }: { s: Synonym }) {
  const { p, act } = useStore()
  const [why, setWhy] = useState('')
  const [open, setOpen] = useState(false)
  const n = codedBySynonym(p!, s).length
  return (
    <div className="space-y-1 w-52">
      {s.status === 'proposed' && <Btn tone="green" onClick={() => act((x) => approveSynonym(x, s.id))}>Approve</Btn>}
      {s.status !== 'retired' && !open && <Btn tone="grey" onClick={() => setOpen(true)}>Retire…</Btn>}
      {open && <div className="space-y-1"><TextArea aria-label={`Reason to retire ${s.verbatim}`} className="min-h-10" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why it is retired" /><div className="flex gap-1"><Btn tone="red" disabled={why.trim().length < 5} onClick={() => { if (act((x) => retireSynonym(x, s.id, why))) setOpen(false) }}>Retire</Btn><Btn tone="grey" onClick={() => setOpen(false)}>Cancel</Btn></div></div>}
      {s.status === 'retired' && n > 0 && <Btn tone="grey" onClick={() => act((x) => { uncodeBySynonym(x, s.id) })}>Re-open its {n} record{n === 1 ? '' : 's'}</Btn>}
    </div>
  )
}
