// Records from the CDM Query & Edit-Check Console: its archive and interim snapshots hold one
// CDASH-style CSV per form (data/ae.csv, data/mh.csv, data/cm.csv: STUDYID, SITEID, SUBJID, VISIT,
// INSTANCE, then the form's variables). The trainer reads those files, or the zip itself (the
// console writes stored, uncompressed zips).
import { createProject, type CodingProject, type Rec } from './coding'
import { itemFor, type Form } from './catalogue'

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c; continue }
    if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x !== '')) rows.push(row); row = [] }
    else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x !== '')) rows.push(row) }
  return rows
}

// Entries of a zip written without compression (method 0). Compressed entries are reported.
export function readStoredZip(bytes: Uint8Array): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = []
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let i = 0
  while (i + 30 <= bytes.length && dv.getUint32(i, true) === 0x04034b50) {
    const method = dv.getUint16(i + 8, true), size = dv.getUint32(i + 18, true), nlen = dv.getUint16(i + 26, true), xlen = dv.getUint16(i + 28, true)
    const name = new TextDecoder().decode(bytes.subarray(i + 30, i + 30 + nlen))
    const start = i + 30 + nlen + xlen
    if (method !== 0) throw new Error(`${name} is compressed; unzip the archive and choose the CSV files instead.`)
    out.push({ name, text: new TextDecoder().decode(bytes.subarray(start, start + size)) })
    i = start + size
  }
  return out
}

const FIELD: Record<Form, string> = { AE: 'AETERM', MH: 'MHTERM', CM: 'CMTRT' }
export function recordsFromCsv(files: { name: string; text: string }[]): { records: Rec[]; study: string; notes: string[] } {
  const records: Rec[] = []
  const notes: string[] = []
  let study = ''
  for (const f of files) {
    const form = (/(^|\/)(ae|mh|cm)\.csv$/i.exec(f.name)?.[2]?.toUpperCase() ?? '') as Form | ''
    if (!form) continue
    const rows = parseCsv(f.text)
    const head = rows[0] ?? []
    const col = (n: string) => head.indexOf(n)
    if (col(FIELD[form]) < 0 || col('SUBJID') < 0) { notes.push(`${f.name}: no ${FIELD[form]} or SUBJID column, skipped.`); continue }
    let n = 0
    for (const r of rows.slice(1)) {
      const v = r[col(FIELD[form])]?.trim()
      if (!v) continue
      study ||= r[col('STUDYID')] || 'HLV-204-201'
      const ind = form === 'CM' && col('CMINDC') >= 0 ? r[col('CMINDC')]?.trim() : undefined
      records.push({ id: `R${String(records.length + 1).padStart(4, '0')}`, study: r[col('STUDYID')] || study, subj: r[col('SUBJID')], form, verbatim: v, ind: ind || undefined,
        itemId: itemFor(r[col('STUDYID')] || study, form, v, ind)?.id, status: 'uncoded', trail: [{ utc: new Date().toISOString(), by: 'Import', what: `Verbatim received: "${v}" (${f.name}, visit ${r[col('VISIT')] ?? ''}, instance ${r[col('INSTANCE')] ?? ''})` }] })
      n++
    }
    notes.push(`${f.name}: ${n} ${form} records.`)
  }
  if (!records.length) throw new Error('No ae.csv, mh.csv or cm.csv with verbatim terms was found. Choose the console\'s archive or interim zip, or the CSV files from its data folder.')
  return { records, study, notes }
}

export async function importConsoleFiles(files: File[], name: string): Promise<{ project: CodingProject; notes: string[] }> {
  const texts: { name: string; text: string }[] = []
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) texts.push(...readStoredZip(new Uint8Array(await f.arrayBuffer())))
    else texts.push({ name: f.name, text: await f.text() })
  }
  const { records, study, notes } = recordsFromCsv(texts)
  const forms = [...new Set(records.map((r) => r.form))]
  const project = createProject({ name, studies: [study], forms })
  project.records = records
  project.source = `Imported from the CDM console: ${files.map((f) => f.name).join(', ')}`
  project.history.push({ utc: new Date().toISOString(), by: 'Import', what: `${records.length} records imported. ${notes.join(' ')}` })
  const inKey = records.filter((r) => r.itemId).length
  notes.push(`${inKey} of ${records.length} records are in the answer key; others are graded when they match a current term or a single-class drug record exactly.`)
  return { project, notes }
}
