// The AI coding assistant: a simulated suggestion model. For each verbatim the autoencoder left,
// it proposes a term (or a query) with a confidence. It is right most of the time and sometimes
// confidently wrong, in the ways such models are: it adds a diagnosis, fixes a class without
// reading the route, or guesses a product from a description. The coder decides every
// suggestion and stays responsible for the coding.
//
// The framing follows FDA's draft guidance "Considerations for the Use of Artificial Intelligence
// to Support Regulatory Decision-Making for Drug and Biological Products" (January 2025; a
// risk-based credibility assessment for a defined context of use) and the EMA and FDA guiding
// principles of good AI practice in drug development (January 2026; among them a risk-based
// approach with human oversight). This model is not real and its figures are invented.
import { keyFor, smdOf, sddList, codeMed, codeDrug, raiseQuery, me, needRole, log, type CodingProject, type Rec } from './coding'
import { exactLlt, ptOf } from './dictmed'
import { itemFor, norm } from './catalogue'
import { hash } from './util'

export const MODEL_CARD = {
  name: 'CodeAssist (simulated)', version: '0.9-training',
  use: 'Suggest a lowest-level term, a drug record and class, or a query, for verbatims the autoencoder did not code. Every suggestion is decided by a trained coder.',
  validation: 'On a held-out set of 1,200 verbatims: top suggestion correct for 89%; at confidence 0.90 or more, correct for 93%.',
  limits: ['Can add a diagnosis the verbatim does not state.', 'Reads the indication but not always the route, so it can pick the wrong class for a multi-class drug.', 'Guesses a product from a description instead of asking for the name.', 'Translations of colloquial or ambiguous foreign terms are uncertain.', 'High confidence is not proof: it is often most confident when it is wrong in a plausible way.', 'Validated on a general set of verbatims: accuracy on a new study, with its own wording, can be lower.'],
}

// Plausible, confident mistakes (normalised verbatim, indication if a medication).
const WRONG: Record<string, { llt?: string; drug?: string; atc?: string; conf: number; why: string }> = {
  'dizziness on standing': { llt: 'Orthostatic hypotension', conf: 0.94, why: 'Matched "on standing" to postural terms.' },
  'severe dizziness with fall': { llt: 'Fall', conf: 0.88, why: 'Took the most specific event in the text.' },
  cold: { llt: 'Common cold', conf: 0.91, why: 'Most frequent meaning of "cold" in adverse event text.' },
  'chest infection': { llt: 'Pneumonia', conf: 0.9, why: 'Nearest diagnosis in the training data.' },
  'eczema flare-up': { llt: 'Hand eczema flare', conf: 0.86, why: 'Nearest flare term.' },
  'potassium 6.1 mmol/l': { llt: 'Hyperkalaemia', conf: 0.93, why: 'A raised potassium value maps to hyperkalaemia.' },
  schwindel: { llt: 'Dizziness', conf: 0.9, why: 'Machine translation: "dizziness".' },
  'water tablet|ankle swelling': { drug: 'Furosemide', atc: 'F03CA', conf: 0.89, why: '"Water tablet" usually means a loop diuretic.' },
  'mometasone cream|atopic dermatitis': { drug: 'Mometasone', atc: 'Q01AD', conf: 0.87, why: 'Most frequent class for mometasone in the training data.' },
  'aspirin|prevention of heart attack': { drug: 'Aspirin', atc: 'K02BA', conf: 0.92, why: 'Aspirin is most often coded as an analgesic.' },
}
const conf = (r: Rec) => 0.72 + (parseInt(hash(norm(r.verbatim) + (r.ind ?? '')).slice(-4), 16) % 27) / 100

export function suggestionFor(p: CodingProject, r: Rec): Rec['suggestion'] | undefined {
  const k = norm(r.verbatim) + (r.form === 'CM' ? `|${norm(r.ind ?? '')}` : '')
  const w = WRONG[k]
  if (w) {
    if (w.llt) { const t = exactLlt(smdOf(p), w.llt); if (t) return { code: t.code, conf: w.conf, why: w.why } }
    if (w.drug) { const d = sddList(p).find((x) => x.name === w.drug); if (d) return { code: d.id, atc: w.atc, conf: w.conf, why: w.why } }
  }
  const key = keyFor(p, r)
  if (!key) return undefined
  const a = key.a, c = Math.round(conf(r) * 100) / 100
  if ('query' in a) return { query: a.query, conf: c, why: a.query === 'split' ? 'The text describes more than one event.' : a.query === 'not-drug' ? 'Not a medicinal product.' : 'The term is ambiguous.' }
  if ('pt' in a) { const t = exactLlt(smdOf(p), a.llt ?? a.pt); return t ? { code: t.code, conf: c, why: `Closest term: ${t.name} (PT ${ptOf(smdOf(p), t.code)?.name}).` } : undefined }
  const d = sddList(p).find((x) => x.name === a.trade && x.ingredients.join('+') === a.ing) ?? sddList(p).find((x) => x.generic && x.ingredients.join('+') === a.ing)
  return d ? { code: d.id, atc: a.atc, conf: c, why: `Matched to ${d.name}; class from the indication "${r.ind}".` } : undefined
}

export function suggestAll(p: CodingProject) {
  if (!p.assistant) return 0
  let n = 0
  for (const r of p.records.filter((x) => x.status === 'uncoded' && !x.suggestion)) { const s = suggestionFor(p, r); if (s) { r.suggestion = { ...s, verbatim: r.verbatim, ind: r.ind }; n++ } }
  return n
}
export function setAssistant(p: CodingProject, on: boolean) {
  needRole(p, ['lead'], 'Switching the coding assistant on or off')
  p.assistant = on; log(p, `Coding assistant ${on ? 'on' : 'off'}`)
  if (on) suggestAll(p)
}
const isRight = (p: CodingProject, r: Rec) => {
  const s = r.suggestion, key = keyFor(p, { ...r, verbatim: r.suggestion?.verbatim ?? r.verbatim, ind: r.suggestion?.ind ?? r.ind })
  if (!s || !key) return undefined
  const a = key.a
  if ('query' in a) return !!s.query
  if (s.query) return false
  if ('pt' in a) return ptOf(smdOf(p), s.code!)?.name === a.pt || ptOf(smdOf(p), s.code!)?.name === ptOf(smdOf(p), exactLlt(smdOf(p), a.llt ?? a.pt)?.code ?? '')?.name
  const d = sddList(p).find((x) => x.id === s.code)
  return !!d && d.ingredients.join('+') === a.ing && s.atc === a.atc
}
export function acceptSuggestion(p: CodingProject, ids: string[]) {
  needRole(p, 'coder', 'Deciding a suggestion')
  for (const id of ids) {
    const r = p.records.find((x) => x.id === id)!
    const s = r.suggestion
    if (!s || r.status !== 'uncoded') continue
    const it = itemFor(r.study, r.form, r.verbatim, r.ind)
    if (s.query) raiseQuery(p, [r.id], s.query, `Coding assistant suggestion, confirmed by the coder: ${s.why} Please clarify the term.`)
    else if (r.form === 'CM') codeDrug(p, [r.id], s.code!, s.atc!)
    else codeMed(p, [r.id], s.code!, false, it?.en ? `${it.en} (assistant translation, checked by ${me(p).name})` : '')
    r.method = s.query ? r.method : 'assistant'
    s.decision = 'accepted'; s.by = me(p).name
  }
  log(p, `Accepted ${ids.length} assistant suggestion(s)`)
}
export function rejectSuggestion(p: CodingProject, ids: string[], reason: string) {
  needRole(p, 'coder', 'Deciding a suggestion')
  if (reason.trim().length < 5) throw new Error('Say why the suggestion is wrong: the reason trains the model and shows the review was real.')
  for (const id of ids) { const r = p.records.find((x) => x.id === id)!; if (r.suggestion) { r.suggestion.decision = 'rejected'; r.suggestion.reason = reason.trim(); r.suggestion.by = me(p).name } }
  log(p, `Rejected ${ids.length} assistant suggestion(s): ${reason.trim()}`)
}
export function assistantStats(p: CodingProject) {
  const rs = p.records.filter((r) => r.suggestion)
  const right = rs.filter((r) => isRight(p, r) === true), wrong = rs.filter((r) => isRight(p, r) === false)
  return {
    shown: rs.length, undecided: rs.filter((r) => !r.suggestion!.decision).length,
    accepted: rs.filter((r) => r.suggestion!.decision === 'accepted').length, rejected: rs.filter((r) => r.suggestion!.decision === 'rejected').length,
    acceptedWrong: wrong.filter((r) => r.suggestion!.decision === 'accepted').length, rejectedRight: right.filter((r) => r.suggestion!.decision === 'rejected').length,
    right: right.length, wrong: wrong.length, acceptedRight: right.filter((r) => r.suggestion!.decision === 'accepted').length,
  }
}
export const suggestionRight = isRight
