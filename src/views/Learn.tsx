import { useState } from 'react'
import { CONVENTIONS } from '../domain/conventions'
import { Panel, Table, Tabs } from './ui'

const P = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-lab-text leading-relaxed">{children}</p>
const L = ({ items }: { items: React.ReactNode[] }) => <ul className="list-disc ml-5 text-sm text-lab-text space-y-1">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
const LESSONS: { id: string; title: string; body: React.ReactNode }[] = [
  { id: 'why', title: '1. Why code', body: <>
    <P>An adverse event is reported in the investigator's words. Two sites write "dizzy" and "light-headed"; a third writes "dizzyness". Coding maps each verbatim term to one term of a standard dictionary so that events can be counted, compared across studies and searched for signals. Medications are coded too, to a standard drug name and a therapeutic class, so the analysis can find every participant who took, say, an antithrombotic.</P>
    <L items={['Adverse events and medical history are coded with MedDRA, the ICH medical terminology, which regulators in the ICH regions expect in clinical study data and safety reports.', 'Medications are coded with WHODrug Global from the Uppsala Monitoring Centre. For studies starting after 15 March 2019, FDA expects a current version in the B3 format (Federal Register, 24 October 2017).', 'Both are licensed, and both release two versions a year (in 2026: MedDRA 29.0 in March and 29.1 in September; WHODrug Global March and September). This trainer uses look-alike training dictionaries instead.']} />
  </> },
  { id: 'meddra', title: '2. The medical dictionary', body: <>
    <P>MedDRA has five levels: system organ class (SOC), high-level group term (HLGT), high-level term (HLT), preferred term (PT) and lowest-level term (LLT). Coders select an LLT, the term closest to the reported words; tables count PTs and group them by SOC. Each PT has one primary SOC and can be linked to others (multiaxiality): shingles is primarily an infection but also appears under skin. Some LLTs are non-current: kept so old data still read, but never selected for new coding.</P>
  </> },
  { id: 'whodrug', title: '3. The drug dictionary', body: <>
    <P>A WHODrug record has a drug record number, sequence number 1 for the active moiety or salt, and sequence number 2 for the name: 001 is the ingredient name, other numbers are trade names. Records carry ATC classes; when a product has more than one (aspirin is an antithrombotic and an analgesic), the coder chooses by indication and route. Combination products have their own records. The B3 format adds fields for the product's form and strength; the trainer keeps the record structure only.</P>
  </> },
  { id: 'conv', title: '4. Coding conventions and queries', body: <>
    <P>ICH publishes "MedDRA Term Selection: Points to Consider", updated each year with the March release, and sponsors write study coding conventions on top. The core ideas: code what was reported, no more and no less; prefer the diagnosis to its symptoms; split separate events; query what cannot be coded without guessing. Queries go to the site through the EDC; the site changes or splits the term and the record returns to the coding queue.</P>
  </> },
  { id: 'auto', title: '5. Autoencoding and synonym lists', body: <>
    <P>Most verbatims match a dictionary term exactly, and the autoencoder codes them. A synonym list adds verbatims the dictionary lacks: spelling variants, abbreviations, local wording. Lists are kept at company and study level and every entry is approved by a second person, because a wrong synonym miscodes every matching record in every study, silently. Vague terms, added diagnoses and fixed drug classes do not belong on a list.</P>
  </> },
  { id: 'qc', title: '6. Review, consistency and metrics', body: <>
    <P>A reviewer who did not code approves the coding, usually grouped by the term chosen so outliers stand out. A consistency report finds the same verbatim coded two ways. Typical metrics are the autoencoding rate, the manual queue, open queries and their age, and the share approved. Coding must be complete and approved before database lock.</P>
  </> },
  { id: 'up', title: '7. Upversioning', body: <>
    <P>The data management plan says which versions a study uses and when it moves: studies seldom take every release, but data pooled for an integrated summary of safety are put on one version. An upgrade starts with an impact report: records on LLTs retired in the new version must be recoded; records whose PT or SOC changed, or whose drug class or product changed, are reviewed and re-approved; synonym entries are updated. The upgrade is signed and documented in the coding report.</P>
  </> },
]

export default function Learn() {
  const [id, setId] = useState(LESSONS[0].id)
  const [tab, setTab] = useState<'lessons' | 'conv'>('lessons')
  const l = LESSONS.find((x) => x.id === id)!
  return (
    <div className="space-y-4">
      <Tabs tabs={[{ id: 'lessons', label: 'Lessons' }, { id: 'conv', label: 'Study coding conventions' }]} value={tab} onChange={setTab} />
      {tab === 'lessons' ? (<>
        <Tabs tabs={LESSONS.map((x) => ({ id: x.id, label: x.title }))} value={id} onChange={setId} />
        <Panel title={l.title}>{l.body}</Panel>
      </>) : (
        <Panel title="Study coding conventions" sub="The rules the trainer grades against, written in this app's words on the principles of MedDRA Term Selection: Points to Consider and common WHODrug coding practice.">
          <Table head={['Rule', 'Dictionary', 'Title', 'Rule', 'Example']} rows={CONVENTIONS.map((c) => [<span className="font-mono">{c.id}</span>, c.dict, c.title, c.rule, <span className="text-lab-text-muted">{c.example}</span>])} />
        </Panel>
      )}
      <Panel title="Sources">
        <L items={[
          <a className="text-lab-fda underline" href="https://www.ich.org/page/meddra" target="_blank" rel="noreferrer">ICH: MedDRA and the Points to Consider documents</a>,
          <a className="text-lab-fda underline" href="https://www.meddra.org/" target="_blank" rel="noreferrer">MedDRA MSSO (versions 29.0, March 2026; 29.1, September 2026)</a>,
          <a className="text-lab-fda underline" href="https://who-umc.org/whodrug/" target="_blank" rel="noreferrer">Uppsala Monitoring Centre: WHODrug Global</a>,
          <a className="text-lab-fda underline" href="https://www.cdisc.org/standards/foundational/sdtmig" target="_blank" rel="noreferrer">CDISC SDTMIG: AE, MH and CM coded variables</a>,
        ]} />
      </Panel>
    </div>
  )
}
