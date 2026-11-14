/** The whole crew at a glance, for Mission Control on Earth.
 *
 *  Reuses the same snapshot and alert rules each astronaut sees, once per crew
 *  member, and orders them by who needs attention most. Earth only hears from
 *  the ship after the radio delay, so by default the readings are that old. */

import { CREW, type Crew } from '../sim/crew'
import { commsDelaySec, dayOf } from '../sim/mission'
import { snapshot, type Snapshot } from '../sim/model'
import type { Scenarios } from '../sim/scenarios'
import { evaluate, type Alert, type Level } from './alerts'

/** What the crew have entered themselves, keyed the same way as the store. */
export interface FleetInputs {
  sheltered: boolean
  reactions: ReadonlyArray<{ crewId: string; day: number; ms: number }>
  /** `${crewId}:${day}` -> eye check logged. */
  eyeChecks: Readonly<Record<string, boolean>>
  /** `${crewId}:${alertId}` -> level the flight surgeon acknowledged it at. */
  acknowledged: Readonly<Record<string, Level>>
}

export interface FleetAlert extends Alert {
  crewId: string
  /** `${crewId}:${alertId}`: stable across ticks, used to acknowledge it. */
  key: string
  /** Acknowledged at this level or a worse one. */
  seen: boolean
}

export interface CrewStatus {
  crew: Crew
  snap: Snapshot
  alerts: FleetAlert[]
  worst: Level | null
  unseen: number
}

export interface Fleet {
  /** Mission minute the readings are from. */
  asOf: number
  /** Most in need of attention first; roster order between equals. */
  crew: CrewStatus[]
  /** Every alert across the crew: most serious first, unseen before seen. */
  alerts: FleetAlert[]
}

const RANK: Record<Level, number> = { urgent: 0, act: 1, watch: 2 }
const NONE = 3
const rankOf = (level: Level | null) => (level ? RANK[level] : NONE)

export const alertKey = (crewId: string, alertId: string) => `${crewId}:${alertId}`

export function fleetStatus(
  t: number,
  scenarios: Scenarios,
  inputs: FleetInputs,
  { delayed = true }: { delayed?: boolean } = {},
): Fleet {
  const asOf = delayed ? t - commsDelaySec(t) / 60 : t
  const day = dayOf(asOf)

  const statuses = CREW.map((crew, index) => {
    const todays = inputs.reactions.filter((r) => r.crewId === crew.id && r.day === day)
    const snap = snapshot(crew, asOf, scenarios, {
      sheltered: inputs.sheltered,
      eyeCheckDone: Boolean(inputs.eyeChecks[`${crew.id}:${day}`]),
      reactionMs: todays.length ? todays[todays.length - 1].ms : undefined,
    })
    const alerts: FleetAlert[] = evaluate(snap).map((a) => {
      const key = alertKey(crew.id, a.id)
      const acked = inputs.acknowledged[key]
      return { ...a, crewId: crew.id, key, seen: acked !== undefined && RANK[acked] <= RANK[a.level] }
    })
    const status: CrewStatus = {
      crew,
      snap,
      alerts,
      worst: alerts.length ? alerts[0].level : null,
      unseen: alerts.filter((a) => !a.seen).length,
    }
    return { status, index }
  })

  statuses.sort(
    (a, b) =>
      rankOf(a.status.worst) - rankOf(b.status.worst) ||
      b.status.unseen - a.status.unseen ||
      a.index - b.index,
  )

  const roster = new Map(CREW.map((c, i) => [c.id, i]))
  const alerts = statuses
    .flatMap((s) => s.status.alerts)
    .sort(
      (a, b) =>
        RANK[a.level] - RANK[b.level] ||
        Number(a.seen) - Number(b.seen) ||
        (roster.get(a.crewId) ?? 0) - (roster.get(b.crewId) ?? 0),
    )

  return { asOf, crew: statuses.map((s) => s.status), alerts }
}
