import type { Crew } from '../sim/crew'
import { MIN_PER_DAY, dayOf, minuteOfDay } from '../sim/mission'
import { dayRecord, exerciseSoFar } from '../sim/model'
import type { Scenarios } from '../sim/scenarios'

export interface Block {
  from: number
  to: number
  /** Minute up to which the block has actually happened. */
  done: number
}

/** Today's blocks for each track of the day ring. Shared with the legend beside the ring. */
export function dayBlocks(crew: Crew, t: number, scenarios: Scenarios) {
  const day = dayOf(t)
  const now = minuteOfDay(t)
  const rec = dayRecord(crew, day, scenarios)
  const tonight = Math.min(MIN_PER_DAY, dayRecord(crew, day + 1, scenarios).sleepStart + MIN_PER_DAY)
  const done = exerciseSoFar(crew, t, scenarios)
  const upTo = (from: number, to: number) => Math.max(from, Math.min(to, now))

  const sleep: Block[] = [
    { from: Math.max(0, rec.sleepStart), to: rec.sleepEnd, done: upTo(Math.max(0, rec.sleepStart), rec.sleepEnd) },
    { from: tonight, to: MIN_PER_DAY, done: upTo(tonight, MIN_PER_DAY) },
  ]
  const exercise: Block[] = [
    { from: rec.cardioStart, to: rec.cardioStart + rec.cardioPlanned, done: rec.cardioStart + done.cardioDone },
    { from: rec.resistanceStart, to: rec.resistanceStart + rec.resistancePlanned, done: rec.resistanceStart + done.resistanceDone },
  ]
  const lightEnd = Math.max(rec.sleepEnd, tonight - 120)
  const light: Block[] = [{ from: rec.sleepEnd, to: lightEnd, done: upTo(rec.sleepEnd, lightEnd) }]
  return { sleep, exercise, light, rec, now }
}
