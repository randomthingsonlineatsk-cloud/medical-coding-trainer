import { useStore } from '../state'
import { medCsv, cmCsv, codingReport } from '../domain/outputs'
import { stats } from '../domain/coding'
import { download } from '../domain/store'
import { Btn, Panel } from './ui'

const SDTM = 'https://randomthingsonlineatsk-cloud.github.io/sdtm-mapping-trainer/'
const CDM = 'https://randomthingsonlineatsk-cloud.github.io/cdm-query-console/'

export default function Outputs() {
  const { p } = useStore()
  const s = stats(p!)
  const name = p!.name.replace(/[^\w-]+/g, '-').slice(0, 40)
  return (
    <div className="space-y-4">
      <Panel title="Coded data" sub="The coded variables of the SDTM AE, MH and CM datasets: the LLT and its code, the preferred term (--DECOD) and its code, HLT, HLGT and the primary system class (--BODSYS and --SOC), and for medications the standardised name (CMDECOD) and class (CMCLAS, CMCLASCD). Each row carries its coding status, so uncoded records are visible.">
        <div className="flex flex-wrap gap-2">
          {p!.forms.includes('AE') && <Btn tone="solid" onClick={() => download(`${name}-AE-coded.csv`, medCsv(p!, 'AE'), 'text/csv')}>Adverse events (CSV)</Btn>}
          {p!.forms.includes('MH') && <Btn tone="grey" onClick={() => download(`${name}-MH-coded.csv`, medCsv(p!, 'MH'), 'text/csv')}>Medical history (CSV)</Btn>}
          {p!.forms.includes('CM') && <Btn tone="grey" onClick={() => download(`${name}-CM-coded.csv`, cmCsv(p!), 'text/csv')}>Medications (CSV)</Btn>}
          <Btn tone="grey" onClick={() => download(`${name}-coding-report.html`, codingReport(p!), 'text/html')}>Coding report (HTML)</Btn>
        </div>
        {s.uncoded + s.queries > 0 && <p className="text-xs text-lab-amber">{s.uncoded} uncoded and {s.queries} queried records: coding is not complete for database lock.</p>}
        <p className="text-xs text-lab-text-muted">The data go on to the <a className="text-lab-fda underline" href={SDTM} target="_blank" rel="noreferrer">SDTM Mapping Trainer</a> (the coded variables of AE, MH and CM). Coding queries are raised and answered in practice in the EDC, as in the <a className="text-lab-fda underline" href={CDM} target="_blank" rel="noreferrer">CDM Query &amp; Edit-Check Console</a>, which codes HLV-204-201 with the same training dictionaries.</p>
      </Panel>
    </div>
  )
}
