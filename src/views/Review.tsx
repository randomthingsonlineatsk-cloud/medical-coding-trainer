import { useState } from 'react'
import { useStore } from '../state'
import { approve, sendBack, consistency, label, verdict, stats, me, smdOf, raiseQuery, type Rec } from '../domain/coding'
import { ptOf } from '../domain/dictmed'
import { showVerdicts } from './Workbench'
import { Btn, Panel, Pill, Stat, Table, TextArea } from './ui'

// Review and QC: a second person approves coding, by coded term so that a whole group is seen
// side by side; the consistency report shows verbatims coded more than one way.
export default function Review() {
  const { p, act } = useStore()
  const s = stats(p!)
  const toApprove = p!.records.filter((r) => r.status === 'coded')
  const byLabel = new Map<string, Rec[]>()
  for (const r of toApprove) { const l = label(p!, r); byLabel.set(l, [...(byLabel.get(l) ?? []), r]) }
  const groups = [...byLabel.entries()].sort((a, b) => b[1].length - a[1].length)
  const con = consistency(p!)
  const show = showVerdicts(p!)
  const [back, setBack] = useState('')
  const [why, setWhy] = useState('')
  const flagged = p!.records.filter((r) => r.flags?.length && !['replaced', 'removed'].includes(r.status))
  return (
    <div className="space-y-4">
      <Panel title="Review and QC" sub="The reviewer approves coding grouped by the term chosen, so verbatims that do not belong stand out. Nobody approves their own coding. Send back anything wrong, with the reason.">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="To approve" value={toApprove.length} tone={toApprove.length ? 'amber' : 'green'} /><Stat label="Approved" value={s.approved} />
          <Stat label="Inconsistent verbatims" value={con.length} tone={con.length ? 'red' : 'green'} /><Stat label="Flagged records" value={flagged.length} tone={flagged.length ? 'amber' : 'grey'} />
          {show ? <Stat label="Accuracy (answer key)" value={`${s.accuracy}%`} tone={s.accuracy >= 95 ? 'green' : 'amber'} /> : <Stat label="Accuracy" value="after submission" />}
        </div>
        {me(p!).role !== 'reviewer' && <p className="text-xs text-lab-text-muted">Approving is for the coding reviewer: switch roles in the header.</p>}
      </Panel>

      {con.length > 0 && (
        <Panel title="Consistency report" sub="The same verbatim (and, for medications, the same indication) coded more than one way. The company codes one way; decide which is right and recode the others.">
          <Table head={['Verbatim', 'Indication', 'Codings']} rows={con.map((c) => [c.verbatim, c.ind ?? '', <ul>{c.codings.map((x) => <li key={x.label}>{x.label}: {x.ids.join(', ')}</li>)}</ul>])} />
        </Panel>
      )}

      <Panel title={`Coded, waiting for approval (${groups.length} terms)`}>
        <Table head={['Coded to', 'Verbatims', 'Records', show ? 'Check' : '', '']} empty="Nothing to approve." rows={groups.map(([l, rs]) => {
          const vs = [...new Set(rs.map((r) => r.verbatim + (r.form === 'CM' ? ` (${r.ind})` : '')))]
          const bad = show ? rs.filter((r) => verdict(p!, r).ok === false).length : 0
          return [l, <span className="text-[11px]">{vs.join('; ')}</span>, rs.length, show ? (bad ? <Pill tone="red">{bad} wrong</Pill> : <Pill tone="green">OK</Pill>) : '',
            <div className="flex flex-wrap gap-1"><Btn tone="green" onClick={() => act((x) => approve(x, rs.map((r) => r.id)))}>Approve {rs.length}</Btn><Btn tone="grey" onClick={() => setBack(back === l ? '' : l)}>Send back…</Btn></div>]
        })} />
        {back && (
          <div className="space-y-1 max-w-xl">
            <p className="text-xs text-lab-text">Send back the records coded to {back}:</p>
            <TextArea aria-label="Reason to send back" className="min-h-12" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="What is wrong (for example: the indication calls for another class)" />
            <Btn tone="red" disabled={why.trim().length < 5} onClick={() => { if (act((x) => { for (const r of byLabel.get(back) ?? []) sendBack(x, r.id, why) })) { setBack(''); setWhy('') } }}>Send back {byLabel.get(back)?.length}</Btn>
          </div>
        )}
      </Panel>

      <CrossCheck />

      {flagged.length > 0 && (
        <Panel title="Flagged records">
          <Table head={['Record', 'Verbatim', 'Status', 'Flags']} rows={flagged.slice(0, 100).map((r) => [r.id, r.verbatim, r.status, <span className="text-[11px] text-lab-amber">{r.flags!.join('; ')}</span>])} />
        </Panel>
      )}
    </div>
  )
}

// Indication cross-check: a medication whose coded indication has no matching history or event
// for the same participant. In practice the reviewer asks the site whether an adverse event or a
// history entry is missing (a painkiller started for new knee pain is often an unreported AE).
function CrossCheck() {
  const { p, act } = useStore()
  const d = smdOf(p!)
  const pts = new Map<string, Set<string>>()
  for (const r of p!.records.filter((x) => x.form !== 'CM' && x.code && ['coded', 'approved'].includes(x.status))) { const k = `${r.study}|${r.subj}`, pt = ptOf(d, r.code!)?.name; if (pt) pts.set(k, (pts.get(k) ?? new Set()).add(pt)) }
  const gaps = p!.records.filter((r) => r.form === 'CM' && r.indCode && ['coded', 'approved'].includes(r.status) && !pts.get(`${r.study}|${r.subj}`)?.has(ptOf(d, r.indCode!)?.name ?? ''))
  if (!p!.records.some((r) => r.form === 'CM')) return null
  return (
    <Panel title={`Indication cross-check (${gaps.length})`} sub="Medications whose coded indication matches no medical history or adverse event of the same participant. Each is a question for the site: is a history entry or an adverse event missing? (Medical history and events must be in the project for this check.)">
      <Table head={['Record', 'Participant', 'Medication', 'Indication', '']} empty="Every coded indication matches the participant's history or events." rows={gaps.slice(0, 60).map((r) => [r.id, `${r.study} ${r.subj}`, r.verbatim, `${r.ind} → ${ptOf(d, r.indCode!)?.name}`, r.flags?.some((f) => f.startsWith('Cross-check')) ? <Pill tone="purple">asked</Pill> : <Btn tone="grey" onClick={() => act((x) => { const rec = x.records.find((y) => y.id === r.id)!; rec.flags = [...(rec.flags ?? []), 'Cross-check: site asked whether a history entry or AE is missing']; rec.trail.push({ utc: new Date().toISOString(), by: me(x).name, what: 'Cross-check question to the site: indication without matching history or adverse event' }) })}>Ask the site</Btn>])} />
    </Panel>
  )
}
