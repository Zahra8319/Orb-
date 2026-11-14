/** Four fictional crew members. Each has their own baselines so the app is personal. */

export interface Crew {
  id: string
  name: string
  role: string
  seed: number
  restingHr: number
  /** Usual bedtime, minute of day. */
  bedtime: number
  /** Hours of sleep this person needs. */
  sleepNeed: number
  /** Reaction-time baseline measured before flight, in ms. */
  reactionBaselineMs: number
  /** Radiation dose from earlier missions, in mSv. */
  priorDoseMsv: number
  /** Personal dose factor: bunk position and shielding differ a little. */
  doseFactor: number
  /** How reliably this person completes prescribed exercise, 0 to 1. */
  exerciseHabit: number
  /** Shifts the 14-day eye check so the crew are not all due on the same day. */
  eyeCheckOffset: number
}

export const CREW: Crew[] = [
  {
    id: 'okafor',
    name: 'Amara Okafor',
    role: 'Commander',
    seed: 11,
    restingHr: 56,
    bedtime: 22 * 60,
    sleepNeed: 7.5,
    reactionBaselineMs: 258,
    priorDoseMsv: 46,
    doseFactor: 1.0,
    exerciseHabit: 0.93,
    eyeCheckOffset: 11,
  },
  {
    id: 'lindqvist',
    name: 'Jonas Lindqvist',
    role: 'Flight engineer',
    seed: 23,
    restingHr: 62,
    bedtime: 22 * 60 + 40,
    sleepNeed: 8,
    reactionBaselineMs: 271,
    priorDoseMsv: 0,
    doseFactor: 1.04,
    exerciseHabit: 0.84,
    eyeCheckOffset: 4,
  },
  {
    id: 'reyes',
    name: 'Sofia Reyes',
    role: 'Medical officer',
    seed: 37,
    restingHr: 59,
    bedtime: 21 * 60 + 30,
    sleepNeed: 7.5,
    reactionBaselineMs: 249,
    priorDoseMsv: 112,
    doseFactor: 0.96,
    exerciseHabit: 0.96,
    eyeCheckOffset: 8,
  },
  {
    id: 'tanaka',
    name: 'Kenji Tanaka',
    role: 'Mission scientist',
    seed: 51,
    restingHr: 65,
    bedtime: 23 * 60,
    sleepNeed: 7,
    reactionBaselineMs: 264,
    priorDoseMsv: 18,
    doseFactor: 1.02,
    exerciseHabit: 0.88,
    eyeCheckOffset: 1,
  },
]

export function crewById(id: string): Crew {
  return CREW.find((c) => c.id === id) ?? CREW[0]
}
