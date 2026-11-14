// Import from the CDM Query & Edit-Check Console, using the console's own export code when the
// console repository sits next to this one (skipped otherwise).
import { expect, test } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createProject, autoencode, verdict } from '../src/domain/coding'
import { readStoredZip, recordsFromCsv } from '../src/domain/importer'

const CONSOLE = fileURLToPath(new URL('../../cdm-query-console/src/domain/lock.ts', import.meta.url))
test.skipIf(!existsSync(CONSOLE))("the console's CDASH CSVs, also inside its zip, become coding records", async () => {
  const { formCsvs, zip } = await import('../../cdm-query-console/src/domain/lock')
  const { createProject: consoleProject, goLive, advance } = await import('../../cdm-query-console/src/domain/project')
  const cp = consoleProject(); goLive(cp); advance(cp, 400)
  const files = formCsvs(cp).filter((f) => /\/(ae|mh|cm)\.csv$/.test(f.name))
  const fromZip = readStoredZip(zip(files))
  expect(fromZip.map((f) => f.name)).toEqual(files.map((f) => f.name))
  const { records, study, notes } = recordsFromCsv(fromZip)
  expect(study).toBe('HLV-204-201')
  expect(records.length).toBeGreaterThan(20)
  expect(new Set(records.map((r) => r.form))).toEqual(new Set(['AE', 'MH', 'CM']))
  expect(notes.length).toBe(3)
  const p = createProject({ name: 'imp', studies: [study], forms: ['AE', 'MH', 'CM'] }); p.records = records
  p.as = p.team.findIndex((m) => m.role === 'coder'); autoencode(p)
  expect(p.records.filter((r) => verdict(p, r).ok !== undefined || r.status === 'uncoded').length).toBeGreaterThan(records.length * 0.8)
})
