import { describe, expect, it } from 'vitest'
import { CREW } from '../sim/crew'
import { START_MIN, commsDelaySec, dayOf, minuteOfDay } from '../sim/mission'
import { NO_SCENARIOS, type Scenarios } from '../sim/scenarios'
import { fleetStatus, type FleetInputs } from './fleet'

const RANK = { urgent: 0, act: 1, watch: 2, none: 3 } as const
const rank = (level: keyof typeof RANK | null) => RANK[level ?? 'none']

const noInputs: FleetInputs = { sheltered: false, reactions: [], eyeChecks: {}, acknowledged: {} }
const storm = (): Scenarios => ({ ...NO_SCENARIOS, solarStorm: START_MIN })
const anHourIn = START_MIN + 60

describe('fleetStatus', () => {
  it('reports every crew member once', () => {
    const fleet = fleetStatus(START_MIN, NO_SCENARIOS, noInputs, { delayed: false })
    expect(fleet.crew.map((c) => c.crew.id).sort()).toEqual(CREW.map((c) => c.id).sort())
  })

  it('puts the crew member who needs attention most first', () => {
    // Tanaka is last in the roster; a very slow reaction test today should lift him up.
    const tanaka = CREW[CREW.length - 1]
    const inputs: FleetInputs = {
      ...noInputs,
      reactions: [{ crewId: tanaka.id, day: dayOf(START_MIN), ms: tanaka.reactionBaselineMs * 2 }],
    }
    const fleet = fleetStatus(START_MIN, NO_SCENARIOS, inputs, { delayed: false })
    const ranks = fleet.crew.map((c) => rank(c.worst))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(fleet.crew[0].crew.id).toBe(tanaka.id)
  })

  it('keeps roster order between crew members in the same state', () => {
    const fleet = fleetStatus(anHourIn, storm(), noInputs, { delayed: false })
    // A storm with nobody sheltered is urgent for everyone, so nobody outranks anyone.
    expect(fleet.crew.every((c) => c.worst === 'urgent')).toBe(true)
    expect(fleet.crew.map((c) => c.crew.id)).toEqual(CREW.map((c) => c.id))
  })

  it('shows Earth readings as old as the radio delay', () => {
    const t = START_MIN + 500
    const fleet = fleetStatus(t, NO_SCENARIOS, noInputs, { delayed: true })
    const asOf = t - commsDelaySec(t) / 60
    expect(fleet.asOf).toBeCloseTo(asOf, 6)
    expect(fleet.crew[0].snap.minuteOfDay).toBeCloseTo(minuteOfDay(asOf), 6)
  })

  it('shows readings as they are now when the delay is off', () => {
    const fleet = fleetStatus(START_MIN, NO_SCENARIOS, noInputs, { delayed: false })
    expect(fleet.asOf).toBe(START_MIN)
  })

  it('lists every alert with who it is for, most serious first', () => {
    const fleet = fleetStatus(anHourIn, storm(), noInputs, { delayed: false })
    const stormAlerts = fleet.alerts.filter((a) => a.id === 'solar-storm')
    expect(stormAlerts.map((a) => a.crewId).sort()).toEqual(CREW.map((c) => c.id).sort())
    const ranks = fleet.alerts.map((a) => rank(a.level))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(new Set(fleet.alerts.map((a) => a.key)).size).toBe(fleet.alerts.length)
  })

  it('marks an alert seen once the flight surgeon has acknowledged it', () => {
    const okafor = CREW[0]
    const inputs: FleetInputs = { ...noInputs, acknowledged: { [`${okafor.id}:solar-storm`]: 'urgent' } }
    const fleet = fleetStatus(anHourIn, storm(), inputs, { delayed: false })
    const mine = fleet.alerts.find((a) => a.crewId === okafor.id && a.id === 'solar-storm')
    const theirs = fleet.alerts.find((a) => a.crewId !== okafor.id && a.id === 'solar-storm')
    expect(mine?.seen).toBe(true)
    expect(theirs?.seen).toBe(false)
  })

  it('shows an alert again when it gets worse than when it was seen', () => {
    const okafor = CREW[0]
    const inputs: FleetInputs = { ...noInputs, acknowledged: { [`${okafor.id}:solar-storm`]: 'watch' } }
    const fleet = fleetStatus(anHourIn, storm(), inputs, { delayed: false })
    const mine = fleet.alerts.find((a) => a.crewId === okafor.id && a.id === 'solar-storm')
    expect(mine?.level).toBe('urgent')
    expect(mine?.seen).toBe(false)
  })

  it('lists unseen alerts before seen ones of the same level', () => {
    const okafor = CREW[0]
    const inputs: FleetInputs = { ...noInputs, acknowledged: { [`${okafor.id}:solar-storm`]: 'urgent' } }
    const urgent = fleetStatus(anHourIn, storm(), inputs, { delayed: false }).alerts.filter(
      (a) => a.level === 'urgent',
    )
    expect(urgent[urgent.length - 1].crewId).toBe(okafor.id)
    expect(urgent[urgent.length - 1].seen).toBe(true)
  })

  it('counts unseen alerts per crew member', () => {
    const okafor = CREW[0]
    const inputs: FleetInputs = { ...noInputs, acknowledged: { [`${okafor.id}:solar-storm`]: 'urgent' } }
    const fleet = fleetStatus(anHourIn, storm(), inputs, { delayed: false })
    const status = fleet.crew.find((c) => c.crew.id === okafor.id)!
    expect(status.unseen).toBe(status.alerts.filter((a) => !a.seen).length)
    expect(status.alerts.find((a) => a.id === 'solar-storm')?.seen).toBe(true)
  })
})
