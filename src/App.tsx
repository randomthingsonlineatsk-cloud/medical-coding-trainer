import { createContext, useContext, useState } from 'react'
import { StoreProvider, useStore } from './state'
import { stats, me, ROLE_LABEL, sddName } from './domain/coding'
import { Btn, Pill, Select } from './views/ui'
import Home from './views/Home'
import Learn from './views/Learn'
import Workbench from './views/Workbench'
import Dictionary from './views/Dictionary'
import Synonyms from './views/Synonyms'
import Review from './views/Review'
import Upgrade from './views/Upgrade'
import Outputs from './views/Outputs'
import Retrieval from './views/Retrieval'
import { MissionBar } from './views/Missions'

export type View = 'workbench' | 'dictionary' | 'synonyms' | 'review' | 'upgrade' | 'retrieval' | 'outputs'
const VIEWS: { id: View; label: string }[] = [
  { id: 'workbench', label: 'Coding workbench' }, { id: 'dictionary', label: 'Dictionaries' }, { id: 'synonyms', label: 'Synonym lists' },
  { id: 'review', label: 'Review and QC' }, { id: 'upgrade', label: 'Upversioning' }, { id: 'retrieval', label: 'Retrieval' }, { id: 'outputs', label: 'Outputs' },
]
const NavCtx = createContext<{ view: View; arg?: string; go: (v: View, arg?: string) => void }>({ view: 'workbench', go: () => {} })
export const useNav = () => useContext(NavCtx)
const ROLE_NOTE = { coder: 'you code and query; approving is for the reviewer.', reviewer: 'you approve or send back coding and approve synonyms; you do not code.', lead: 'you run the autoencoder, retire synonyms and apply dictionary upgrades.' }

function Shell() {
  const { p, close, error, setError, saved, act } = useStore()
  const [nav, setNav] = useState<{ view: View; arg?: string }>({ view: 'workbench' })
  const [page, setPage] = useState<'home' | 'learn'>(() => (location.hash === '#/learn' ? 'learn' : 'home'))
  const go = (view: View, arg?: string) => { setNav({ view, arg }); window.scrollTo({ top: 0 }) }
  const s = p ? stats(p) : null
  const V = { workbench: Workbench, dictionary: Dictionary, synonyms: Synonyms, review: Review, upgrade: Upgrade, retrieval: Retrieval, outputs: Outputs }[nav.view]
  return (
    <NavCtx.Provider value={{ ...nav, go }}>
      <div className="min-h-screen bg-lab-bg text-lab-text flex flex-col">
        <header className="border-b border-lab-line bg-lab-panel/90 sticky top-0 z-40 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="mr-auto">
              <button className="font-mono text-sm text-lab-fda text-left" onClick={() => { close(); setPage('home') }}>Medical Coding Trainer</button>
              <p className="text-[11px] text-lab-text-muted">{p ? `${p.name} · SMD ${p.smd} · ${sddName(p.sdd)}` : 'Adverse events, history and medications · training dictionaries · training only'}</p>
            </div>
            {p && s && (
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={s.uncoded ? 'amber' : 'green'}>{s.total - s.uncoded} of {s.total} coded</Pill>
                <Pill tone={s.approved === s.total ? 'green' : 'grey'}>{s.approved} approved</Pill>
                {s.queries > 0 && <Pill tone="purple">{s.queries} open queries</Pill>}
                <label className="flex items-center gap-1 text-[11px] text-lab-text-muted">Working as
                  <Select aria-label="Working as" className="w-56 py-1 text-xs" value={String(p.as)} onChange={(e) => act((x) => { x.as = Number(e.target.value) })} options={p.team.map((m, i) => ({ value: String(i), label: `${m.name} (${ROLE_LABEL[m.role]})` }))} />
                </label>
                <Btn tone="grey" onClick={() => { close(); setPage('home') }}>All projects</Btn>
              </div>
            )}
            {!p && (
              <nav className="flex gap-1" aria-label="Main">
                {(['home', 'learn'] as const).map((x) => <button key={x} onClick={() => setPage(x)} aria-current={page === x ? 'page' : undefined} className={`px-3 py-1.5 font-mono text-xs border-b-2 ${page === x ? 'border-lab-fda text-lab-fda' : 'border-transparent text-lab-text-muted hover:text-lab-text'}`}>{x === 'home' ? 'Projects and missions' : 'Learn and conventions'}</button>)}
              </nav>
            )}
          </div>
          {p && (
            <nav className="max-w-7xl mx-auto px-4 flex flex-wrap gap-1" aria-label="Coding steps">
              {VIEWS.map((v) => (
                <button key={v.id} onClick={() => go(v.id)} aria-current={nav.view === v.id ? 'page' : undefined}
                  className={`px-3 py-1.5 font-mono text-xs border-b-2 ${nav.view === v.id ? 'border-lab-fda text-lab-fda' : 'border-transparent text-lab-text-muted hover:text-lab-text'}`}>{v.label}</button>
              ))}
            </nav>
          )}
        </header>
        {p && <div className="max-w-7xl mx-auto w-full px-4 pt-2 text-[11px] text-lab-text-muted">Working as <b className="text-lab-text">{me(p).name}</b>, {ROLE_LABEL[me(p).role].toLowerCase()}: {ROLE_NOTE[me(p).role]}</div>}
        {error && <div role="alert" className="max-w-7xl mx-auto w-full px-4 pt-3"><div className="rounded border border-lab-red/60 bg-lab-red-soft px-3 py-2 text-sm text-lab-red flex justify-between gap-2"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss">✕</button></div></div>}
        <main className="max-w-7xl mx-auto w-full px-4 py-4 flex-1">
          {p ? <><MissionBar /><V /></> : page === 'learn' ? <Learn /> : <Home onOpen={() => go('workbench')} />}
        </main>
        <footer className="border-t border-lab-line text-[11px] text-lab-text-muted">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between gap-2">
            <span>Built by Khan Gulrez Shagufa Fazal Ahmed · Apache-2.0</span>
            <span>Training only. Fictional studies; training dictionaries shaped like MedDRA and WHODrug, with none of their content. Saved in this browser{saved ? ` · saved ${saved}` : ''}.</span>
          </div>
        </footer>
      </div>
    </NavCtx.Provider>
  )
}

export default function App() { return <StoreProvider><Shell /></StoreProvider> }
