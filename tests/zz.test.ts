import { test } from 'vitest'
import { startMission, grade, solve } from '../src/domain/missions'
import { stats } from '../src/domain/coding'
test('m', () => {
  for (const id of ['M1', 'M2', 'M3', 'M5']) { const p = startMission(id, 'standard'); solve(p); const g = grade(p)!; console.log(id, g.score, JSON.stringify(stats(p)), g.results.filter((r) => !r.ok).map((r) => r.id).join(',')) }
  const p = startMission('M4', 'standard'); const g = grade(p)!; console.log('M4 start', g.score, JSON.stringify(stats(p)))
})
