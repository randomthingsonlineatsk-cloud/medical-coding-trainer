import { useState } from 'react'
import { useStore } from '../state'
import { impact, applyUpgrade, staleSynonyms, IMPACT_LABEL, type ImpactKind } from '../domain/upgrade'
import { me, ROLE_LABEL, sddName } from '../domain/coding'
import { Btn, Panel, Pill, SignForm, Stat, Table, TextArea } from './ui'

// Upversioning a study to the next dictionary versions, after an impact review.
export default function Upgrade() {
  const { p, act } = useStore()
  const [note, setNote] = useState('')
  const done = p!.smd === '1.1' && p!.sdd === 'Q3'
  const im = impact(p!)
  const count = (k: ImpactKind) => im.rows.filter((r) => r.kind === k).length
  return (
    <div className="space-y-4">
      <Panel title="Upversioning" sub="Both dictionaries publish two versions a year. A study does not chase every release: the data management plan says when to upgrade (often before database lock or before data are pooled for an integrated safety summary). Before applying, the team reviews the impact; after, it recodes, re-reviews and documents the change.">
        <p className="text-sm text-lab-text">In force: <b>SMD {p!.smd}</b> and <b>{sddName(p!.sdd)}</b>.{done ? ' This project is on the latest versions.' : ' Available: SMD 1.1 and SDD 2026 Q3.'}</p>
        {p!.upgrades.map((u) => <p key={u.utc} className="text-xs text-lab-text-muted">{u.from} → {u.to}, {u.utc.slice(0, 10)}, signed {u.signed.name}: {u.note}</p>)}
      </Panel>
      {!done && (
        <>
          <Panel title="Impact report" sub="What the new versions change in this project's coding, record by record.">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              {(Object.keys(IMPACT_LABEL) as ImpactKind[]).map((k) => <Stat key={k} label={IMPACT_LABEL[k]} value={count(k)} tone={count(k) ? 'amber' : 'grey'} />)}
              <Stat label="Synonyms to retarget" value={im.synonyms.length} tone={im.synonyms.length ? 'amber' : 'grey'} />
            </div>
            <Table head={['Record', 'Verbatim', 'Impact', 'Now', 'After the upgrade']} rows={im.rows.map((r) => [r.id, r.verbatim, <Pill tone={r.kind === 'recode' || r.kind === 'name-changed' ? 'red' : 'amber'}>{IMPACT_LABEL[r.kind]}</Pill>, r.from, r.to])} empty="No coded record is affected." />
            {im.synonyms.length > 0 && <p className="text-xs text-lab-amber">Synonyms pointing to terms retired in 1.1: {im.synonyms.map((s) => `"${s.verbatim}"`).join(', ')}.</p>}
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!p!.reviewedImpact} onChange={(e) => act((x) => { x.reviewedImpact = e.target.checked })} /> I have reviewed the impact report</label>
          </Panel>
          <Panel title="Apply the upgrade" sub="Retired terms send their records back to the queue; records whose preferred term, system class, drug class or product changes lose their approval and are flagged for review; synonyms to retired terms are flagged.">
            <TextArea aria-label="Upgrade note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="The versions, why now (the DMP trigger), what the impact review found and how it will be handled." />
            <SignForm key={me(p!).name} who={{ name: me(p!).name, role: ROLE_LABEL[me(p!).role] }} meaning="I approve the upgrade of this project's coding to the new dictionary versions." label="Apply the upgrade" disabled={me(p!).role !== 'lead' || !p!.reviewedImpact || note.trim().length < 20} onSign={(s) => act((x) => { applyUpgrade(x, s, note) })} />
            {me(p!).role !== 'lead' && <p className="text-xs text-lab-text-muted">Upgrades are applied by the coding lead: switch roles in the header.</p>}
          </Panel>
        </>
      )}
      {done && staleSynonyms(p!).length > 0 && <Panel title="After the upgrade"><p className="text-xs text-lab-amber">Synonyms still pointing at retired terms: {staleSynonyms(p!).map((s) => `"${s.verbatim}"`).join(', ')}. Retire them on the Synonym lists page.</p></Panel>}
    </div>
  )
}
