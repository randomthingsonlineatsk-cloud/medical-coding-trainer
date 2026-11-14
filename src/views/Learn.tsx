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
  { id: 'retr', title: '8. Retrieval: search groups and system classes', body: <>
    <P>Coding is done to be searched. MedDRA's Standardised MedDRA Queries group preferred terms for one medical condition, with a narrow scope (terms very likely to mean it) and a broad scope (adding terms that may). The ICH "MedDRA Data Retrieval and Presentation: Points to Consider" explains when to use them and how to build a custom query when none fits. It also explains multiaxiality in practice: incidence tables count each event once, under its primary system class, while a search for everything in a class should also use the secondary links.</P>
  </> },
  { id: 'ind', title: '9. Indications', body: <>
    <P>The indication of each medication is usually coded with the medical dictionary, like a medical history term. Coded indications let the reviewer check them against the participant's history and events: a painkiller started for knee pain during the study, with no knee pain in the adverse events, often means an adverse event was not reported. In SDTM the coded indication has no standard CM variable and travels as a supplemental qualifier.</P>
  </> },
  { id: 'ai', title: '10. AI-assisted coding', body: <>
    <P>Coding tools increasingly suggest terms with a confidence score. The risk is automation bias: accepting a plausible suggestion because it is confident. Typical errors are an added diagnosis, a class chosen without reading the route, a product guessed from a description, and a translation that hides an ambiguity. FDA's draft guidance on AI to support regulatory decision-making (January 2025) asks for a credibility assessment scaled to the model's risk in its context of use; the EMA and FDA guiding principles of good AI practice in drug development (January 2026) include a risk-based approach with human oversight. In coding, that means a trained coder decides every suggestion, records why a rejection was made, and an independent reviewer approves the result.</P>
  </> },
  { id: 'lang', title: '11. Verbatims in other languages', body: <>
    <P>Multinational studies receive terms in local languages. MedDRA has language versions with the same codes as English, so an exact match codes directly; a colloquial term needs a translation, recorded with the coding so a reviewer can follow it. Some words do not translate one to one: German "Schwindel" and Japanese めまい each cover both dizziness and vertigo, which the dictionary separates, so they are queried.</P>
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
          <a className="text-lab-fda underline" href="https://www.fda.gov/regulatory-information/search-fda-guidance-documents/considerations-use-artificial-intelligence-support-regulatory-decision-making-drug-and-biological" target="_blank" rel="noreferrer">FDA draft guidance: Considerations for the Use of AI to Support Regulatory Decision-Making for Drug and Biological Products (January 2025)</a>,
        ]} />
      </Panel>
    </div>
  )
}
