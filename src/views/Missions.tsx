import { useState } from 'react'
import { useStore } from '../state'
import { MISSIONS, startMission, grade, submitMission, certificate, CERT_NEEDED, type Level } from '../domain/missions'
import { getLearner, setLearnerName, passportRecord, APP_ID, APP_URL, PASSPORT_PAGE } from '../domain/passport'
import { download } from '../domain/store'
import { Btn, Panel, Pill, Select, Table, fmtUtc, ic } from './ui'

const LEVELS: { value: Level; label: string }[] = [
  { value: 'guided', label: 'Guided: goals, hints and answer-key feedback' },
  { value: 'standard', label: 'Standard: goals shown, no hints, no answer-key feedback' },
  { value: 'expert', label: 'Expert: goals shown only after you submit' },
]

// The missions panel on the home page.
export default function Missions({ onOpen }: { onOpen?: () => void }) {
  const { projects, open } = useStore()
  const [level, setLevel] = useState<Level>('guided')
  const done = projects.filter((p) => p.mission)
  return (
    <Panel title="Missions" sub="Set coding tasks graded against the answer key. The grade reads the project itself: the coding, the queries, the approvals, the synonym list and the dictionary versions.">
      <label className="text-xs text-lab-text-muted block max-w-sm">Level<Select value={level} onChange={(e) => setLevel(e.target.value as Level)} options={LEVELS} /></label>
      <div className="grid md:grid-cols-3 xl:grid-cols-5 gap-3">
        {MISSIONS.map((m) => (
          <div key={m.id} className="rounded border border-lab-line bg-lab-panel-strong/50 p-3 space-y-2 flex flex-col">
            <h3 className="font-mono text-xs text-lab-text"><Pill tone="purple" className="mr-1">{m.id}</Pill>{m.title}</h3>
            <p className="text-xs text-lab-text-muted flex-1">{m.brief}</p>
            <Btn tone="solid" onClick={() => { open(startMission(m.id, level)); onOpen?.() }}>Start {m.id}</Btn>
          </div>
        ))}
      </div>
      {done.length > 0 && (
        <Table head={['Mission', 'Level', 'Started', 'Result', '']} rows={done.map((p) => {
          const g = grade(p)
          return [p.name, p.mission!.level, fmtUtc(p.mission!.startedUtc), p.mission!.endedUtc ? <Pill tone={(p.mission!.score ?? 0) >= 80 ? 'green' : 'amber'}>Submitted: {p.mission!.score}%</Pill> : <span className="text-lab-text-muted">In progress{p.mission!.level !== 'expert' && g ? ` (${g.score}% so far)` : ''}</span>, <Btn onClick={() => { open(p); onOpen?.() }}>Open</Btn>]
        })} />
      )}
      <Certificate />
    </Panel>
  )
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
function Certificate() {
  const { projects } = useStore()
  const [learner, setLearner] = useState(getLearner)
  const c = certificate(projects, learner.userId, learner.name)
  const issued = new Date().toISOString().slice(0, 10)
  const criteria = c.runs.map((r) => ({ label: `${r.id} ${r.title}: passed (80% or more)`, met: !!r.p }))
  const html = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Certificate: medical coding</title><style>body{font-family:Georgia,serif;max-width:46rem;margin:3rem auto;padding:2rem;border:6px double #1d3b5a;color:#1d2433;background:#fff}h1{font-size:1.6rem;text-align:center}p,li{font-size:1rem}.c{font-family:ui-monospace,monospace;font-size:1.1rem;text-align:center;margin-top:1.5rem}.s{font-size:.8rem;color:#555}</style></head><body><p class="s">Medical Coding Trainer · training certificate</p><h1>${esc(learner.name)}</h1><p style="text-align:center">has completed the five medical coding missions${c.distinction ? ', with distinction' : ''}:</p><ul>${c.runs.map((r) => `<li>${esc(r.id)} ${esc(r.title)}: ${r.p!.mission!.score}% (${esc(r.p!.mission!.level)})</li>`).join('')}</ul><p>Coding adverse events, medical history and medications with training dictionaries shaped like MedDRA and WHODrug; coding conventions and site queries; independent review; synonym list governance; dictionary upversioning; coding at scale.</p><p class="c">Verification code ${esc(c.code)}</p><p class="s">Issued ${issued}. Learner ID ${esc(learner.userId)}. Check it on the Regulatory Skills Passport: ${PASSPORT_PAGE}. A portfolio certificate from a training app, not an accreditation. Built by Khan Gulrez Shagufa Fazal Ahmed.</p></body></html>`
  return (
    <div className="rounded border border-lab-line p-3 space-y-2">
      <h3 className="font-mono text-xs text-lab-text">Certificate</h3>
      <p className="text-xs text-lab-text-muted">Pass all {CERT_NEEDED} missions (submitted at 80% or more) for a certificate with a verification code; three or more at expert level earn a distinction. The Passport on the pharmolecule hub checks it.</p>
      <div className="flex flex-wrap gap-1">{c.runs.map((r) => <Pill key={r.id} tone={r.p ? 'green' : 'grey'}>{r.id} {r.p ? `${r.p.mission!.score}%` : 'not yet'}</Pill>)}</div>
      <label className="text-xs text-lab-text-muted block max-w-sm">Name on the certificate<input className={ic('')} value={learner.name} onChange={(e) => setLearner(setLearnerName(e.target.value))} /></label>
      {c.eligible ? (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="font-mono text-sm text-lab-cdsco">{c.code}</span>
          <Btn tone="solid" disabled={!learner.name.trim()} onClick={() => download('medical-coding-certificate.html', html(), 'text/html')}>Certificate (HTML)</Btn>
          <Btn tone="grey" disabled={!learner.name.trim()} onClick={() => download('medical-coding-passport-record.json', JSON.stringify(passportRecord({ app: APP_ID, appName: 'Medical Coding Trainer', certificate: 'Medical coding', appUrl: APP_URL, name: learner.name, userId: learner.userId, issued, basis: c.basis, code: c.code, criteria, distinction: c.distinction }), null, 2))}>Passport record (JSON)</Btn>
          <a className="text-xs text-lab-fda underline" href={PASSPORT_PAGE} target="_blank" rel="noreferrer">Open the Passport</a>
        </div>
      ) : <p className="text-xs text-lab-text-muted">{c.runs.filter((r) => r.p).length} of {CERT_NEEDED} passed.</p>}
    </div>
  )
}

// The mission bar above each page of a mission build.
export function MissionBar() {
  const { p, act } = useStore()
  const [show, setShow] = useState(false)
  const g = p ? grade(p) : null
  if (!p || !g) return null
  const m = p.mission!
  const ended = !!m.endedUtc
  const goalsShown = m.level !== 'expert' || ended
  return (
    <div className="mb-4 rounded border border-lab-purple/50 bg-lab-panel p-3 space-y-2" aria-label="Mission">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="purple">{g.mission.id}</Pill><span className="text-sm text-lab-text">{g.mission.title}</span><Pill>{m.level}</Pill>
        {ended ? <Pill tone={(m.score ?? 0) >= 80 ? 'green' : 'amber'}>Submitted: {m.score}%{(m.score ?? 0) >= 80 ? ', passed' : ', not yet passed'}</Pill> : goalsShown && <Pill tone="blue">{g.score}% so far</Pill>}
        <span className="flex-1" />
        {goalsShown && <Btn tone="grey" onClick={() => setShow(!show)}>{show ? 'Hide goals' : `Show goals (${g.results.filter((r) => r.ok).length} of ${g.results.length} met)`}</Btn>}
        {!ended && <Btn tone="solid" onClick={() => act((x) => { submitMission(x) })}>Submit for grading</Btn>}
      </div>
      <p className="text-xs text-lab-text-muted">{g.mission.brief}</p>
      {goalsShown && show && (
        <ul className="text-xs space-y-1">
          {g.results.map((r) => (
            <li key={r.id} className="flex gap-2">
              <span aria-label={r.ok ? 'Met' : 'Not met'} className={r.ok ? 'text-lab-cdsco' : 'text-lab-text-muted'}>{r.ok ? '✓' : '○'}</span>
              <span className={r.ok ? 'text-lab-text' : 'text-lab-text-muted'}>{r.text} <span className="text-lab-text-muted">({r.weight} points)</span>{m.level === 'guided' && !r.ok && <span className="block text-lab-amber">Hint: {r.hint}</span>}</span>
            </li>
          ))}
        </ul>
      )}
      {ended && <p className="text-xs text-lab-text-muted">Submitted {fmtUtc(m.endedUtc)} UTC. You can keep working on this build; the grade above is the one submitted. Start the mission again for a new attempt.</p>}
    </div>
  )
}
