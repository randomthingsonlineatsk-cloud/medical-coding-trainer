import { useRef, useState } from 'react'
import { useStore } from '../state'
import { createProject, stats, type CodingProject } from '../domain/coding'
import { STUDIES, type Form } from '../domain/catalogue'
import { download } from '../domain/store'
import Missions from './Missions'
import { Btn, Panel, Pill, Table, fmtUtc, ic } from './ui'

export default function Home({ onOpen }: { onOpen: () => void }) {
  const { projects, open, remove, setError } = useStore()
  const [studies, setStudies] = useState<string[]>(['HLV-204-201'])
  const [forms, setForms] = useState<Form[]>(['AE', 'MH', 'CM'])
  const [name, setName] = useState('Practice coding')
  const file = useRef<HTMLInputElement>(null)
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])
  const n = (s: string[], f: Form[]) => createProject({ name: 'x', studies: s, forms: f }).records.length
  const importFile = async (f: File) => {
    try { const p = JSON.parse(await f.text()) as CodingProject; if (p.schema !== 1 || !Array.isArray(p.records)) throw new Error('not a coding project file'); open(p); onOpen() } catch (e) { setError(`Could not open this file: ${(e as Error).message}`) }
  }
  return (
    <div className="space-y-4">
      <Panel title="Medical coding, from verbatim to coded dataset" sub="Sites write what the participant reported: 'headace', 'Lipidra 20 mg', 'cold'. Coders turn those words into dictionary terms so events and medications can be counted and compared. This trainer uses two training dictionaries shaped like MedDRA (medical) and WHODrug (drugs), the study's coding conventions, an autoencoder with synonym lists, site queries, independent review and dictionary upgrades.">
        <p className="text-xs text-lab-text-muted">The dictionaries are fictional: same structure, invented names, codes and classes, and no MedDRA or WHODrug content. Real coding needs licences from MSSO (MedDRA) and Uppsala Monitoring Centre (WHODrug).</p>
      </Panel>
      <Panel title="New practice project">
        <div className="grid md:grid-cols-3 gap-3">
          <fieldset className="space-y-1 text-xs"><legend className="text-lab-text mb-1">Studies</legend>
            {STUDIES.map((s) => <label key={s.id} className="flex gap-2"><input type="checkbox" checked={studies.includes(s.id)} onChange={() => setStudies(toggle(studies, s.id))} /> {s.id} <span className="text-lab-text-muted">{s.name}</span></label>)}
          </fieldset>
          <fieldset className="space-y-1 text-xs"><legend className="text-lab-text mb-1">Forms</legend>
            {(['AE', 'MH', 'CM'] as Form[]).map((f) => <label key={f} className="flex gap-2"><input type="checkbox" checked={forms.includes(f)} onChange={() => setForms(toggle(forms, f))} /> {f === 'AE' ? 'Adverse events' : f === 'MH' ? 'Medical history' : 'Concomitant medications'}</label>)}
          </fieldset>
          <div className="space-y-2">
            <label className="text-xs text-lab-text-muted block">Name<input className={ic('')} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <Btn tone="solid" disabled={!studies.length || !forms.length} onClick={() => { open(createProject({ name, studies, forms, seed: Date.now() % 1000 })); onOpen() }}>Create ({studies.length && forms.length ? n(studies, forms) : 0} records)</Btn>
          </div>
        </div>
      </Panel>
      <Missions onOpen={onOpen} />
      <Panel title="Your projects" right={<><Btn tone="grey" onClick={() => file.current?.click()}>Open a project file</Btn><input ref={file} type="file" accept=".json" className="hidden" aria-label="Project file" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} /></>}>
        <Table head={['Project', 'Records', 'Coded', 'Approved', 'Dictionaries', 'Updated (UTC)', '']} empty="No projects yet." rows={projects.map((p) => {
          const s = stats(p)
          return [<span>{p.name}{p.mission && <Pill tone="purple" className="ml-1">{p.mission.id}</Pill>}</span>, s.total, s.total - s.uncoded, s.approved, `SMD ${p.smd} · SDD ${p.sdd}`, fmtUtc(p.updated),
            <div className="flex gap-1"><Btn onClick={() => { open(p); onOpen() }}>Open</Btn><Btn tone="grey" onClick={() => download(`${p.name.replace(/\W+/g, '-')}.json`, JSON.stringify(p))}>Save file</Btn><Btn tone="red" onClick={() => remove(p.id)}>Delete</Btn></div>]
        })} />
      </Panel>
    </div>
  )
}
