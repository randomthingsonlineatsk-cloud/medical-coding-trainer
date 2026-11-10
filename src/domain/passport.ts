// Skills Passport record: carries the certificate to the Regulatory Skills Passport on the
// pharmolecule hub, which recomputes the verification code from the basis and the seal from the
// rest of the record. Same format (schema 1, cyrb53) as the CDM console, the SDTM trainer and the EDC lab.
import { hash } from './util'

export const PASSPORT_KIND = 'pharmolecule/passport-record' as const
export const PASSPORT_PAGE = 'https://randomthingsonlineatsk-cloud.github.io/pharmolecule/passport.html'
export const APP_ID = 'medical-coding-trainer'
export const APP_URL = 'https://randomthingsonlineatsk-cloud.github.io/medical-coding-trainer/'
const NOTICE = 'Portfolio certificate from a training app. Not an accreditation.'

export interface PassportFields { app: string; appName: string; certificate: string; appUrl: string; name: string; userId: string; issued: string; basis: string; code: string; criteria: { label: string; met: boolean }[]; distinction: boolean }
export const sealOf = (rec: object) => { const { seal: _s, ...rest } = rec as Record<string, unknown>; return hash(JSON.stringify(rest)) }
export function passportRecord(f: PassportFields) {
  const rec = { kind: PASSPORT_KIND, schema: 1, ...f, alg: 'cyrb53' as const, notice: NOTICE }
  return { ...rec, seal: sealOf(rec) }
}

// The learner on this browser: a name for the certificate and a random learner ID.
const KEY = 'medical-coding-trainer:learner'
export function getLearner(): { name: string; userId: string } {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v?.userId) return v } catch { /* storage blocked */ }
  const v = { name: '', userId: `L-${Math.random().toString(36).slice(2, 10)}` }
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* storage blocked */ }
  return v
}
export function setLearnerName(name: string) {
  const v = { ...getLearner(), name }
  try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* storage blocked */ }
  return v
}
