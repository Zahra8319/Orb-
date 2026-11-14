import { describe, expect, it } from 'vitest'
import { CREW } from '../sim/crew'
import { START_MIN } from '../sim/mission'
import { snapshot, type Snapshot } from '../sim/model'
import { NO_SCENARIOS } from '../sim/scenarios'
import { evaluate, worstLevel } from './alerts'

function nominal(overrides: Partial<Snapshot> = {}): Snapshot {
  const base: Snapshot = {
    day: 143,
    minuteOfDay: 580,
    vitals: { heartRate: 58, spo2: 98, breathing: 14, skinTemp: 36.4, irregular: false, activity: 'awake' },
    cabin: { co2: 2.4, o2: 21.2, pressure: 101.3, temperature: 22.5, humidity: 45, noise: 58 },
    doseRate: 1.8,
    baseDoseRate: 1.8,
    missionDose: 257,
    careerDose: 300,
    sleepAvg7: 7.2,
    sleepDebt7: 2,
    missedExerciseDays: 0,
    reactionMs: 262,
    reactionBaselineMs: 260,
    eyeCheckDue: false,
    sheltered: false,
  }
  return { ...base, ...overrides }
}
const ids = (s: Snapshot) => evaluate(s).map((a) => a.id)
const level = (s: Snapshot, id: string) => evaluate(s).find((a) => a.id === id)?.level

describe('alert rules', () => {
  it('raise nothing on a normal day', () => {
    expect(evaluate(nominal())).toEqual([])
  })
  it('raise nothing above watch for any crew member at the demo start', () => {
    for (const crew of CREW) {
      const alerts = evaluate(snapshot(crew, START_MIN, NO_SCENARIOS))
      expect(alerts.filter((a) => a.level !== 'watch')).toEqual([])
    }
  })
  it('every alert says what to do and where to look', () => {
    const s = nominal({
      doseRate: 20,
      cabin: { ...nominal().cabin, co2: 7 },
      sleepAvg7: 4.5,
      missedExerciseDays: 4,
      vitals: { ...nominal().vitals, irregular: true, spo2: 88 },
    })
    const alerts = evaluate(s)
    expect(alerts.length).toBeGreaterThanOrEqual(5)
    for (const a of alerts) {
      expect(a.title.length).toBeGreaterThan(8)
      expect(a.action.length).toBeGreaterThan(8)
      expect(a.to.startsWith('/')).toBe(true)
    }
  })
  it('sorts the most serious alert first', () => {
    const alerts = evaluate(nominal({ doseRate: 20, sleepAvg7: 5.8 }))
    expect(alerts[0].level).toBe('urgent')
    expect(worstLevel(alerts)).toBe('urgent')
    expect(worstLevel([])).toBeNull()
  })

  it('CO2: watch above 3, act above 4, urgent above 6 mmHg', () => {
    const at = (co2: number) => level(nominal({ cabin: { ...nominal().cabin, co2 } }), 'co2')
    expect(at(3.0)).toBeUndefined()
    expect(at(3.1)).toBe('watch')
    expect(at(4.1)).toBe('act')
    expect(at(6.1)).toBe('urgent')
  })
  it('cabin oxygen: watch below 19.5 kPa, urgent below 18', () => {
    const at = (o2: number) => level(nominal({ cabin: { ...nominal().cabin, o2 } }), 'o2')
    expect(at(19.5)).toBeUndefined()
    expect(at(19.4)).toBe('watch')
    expect(at(17.9)).toBe('urgent')
  })
  it('blood oxygen: watch below 94, urgent below 90', () => {
    const at = (spo2: number) => level(nominal({ vitals: { ...nominal().vitals, spo2 } }), 'spo2')
    expect(at(94)).toBeUndefined()
    expect(at(93)).toBe('watch')
    expect(at(89)).toBe('urgent')
  })
  it('resting heart rate above 110 needs action, but not during exercise', () => {
    const resting = nominal({ vitals: { ...nominal().vitals, heartRate: 118 } })
    const cardio = nominal({ vitals: { ...nominal().vitals, heartRate: 150, activity: 'cardio' } })
    expect(level(resting, 'heart-rate')).toBe('act')
    expect(ids(cardio)).not.toContain('heart-rate')
  })
  it('an irregular rhythm is urgent', () => {
    expect(level(nominal({ vitals: { ...nominal().vitals, irregular: true } }), 'rhythm')).toBe('urgent')
  })
  it('solar storm: urgent at five times the normal dose rate, calmer once sheltered', () => {
    expect(ids(nominal({ doseRate: 8.9 }))).not.toContain('solar-storm')
    expect(level(nominal({ doseRate: 9.1 }), 'solar-storm')).toBe('urgent')
    const sheltered = evaluate(nominal({ doseRate: 9.1, sheltered: true })).find((a) => a.id === 'solar-storm')
    expect(sheltered?.level).toBe('act')
    expect(sheltered?.action).toMatch(/stay/i)
  })
  it('career dose: watch from 80% of the 600 mSv limit', () => {
    expect(ids(nominal({ careerDose: 479 }))).not.toContain('career-dose')
    expect(level(nominal({ careerDose: 481 }), 'career-dose')).toBe('watch')
  })
  it('sleep: watch under 6 hours a night, act under 5', () => {
    expect(ids(nominal({ sleepAvg7: 6 }))).not.toContain('sleep')
    expect(level(nominal({ sleepAvg7: 5.9 }), 'sleep')).toBe('watch')
    expect(level(nominal({ sleepAvg7: 4.9 }), 'sleep')).toBe('act')
  })
  it('exercise: watch after 2 missed days, act after 4', () => {
    expect(ids(nominal({ missedExerciseDays: 1 }))).not.toContain('exercise')
    expect(level(nominal({ missedExerciseDays: 2 }), 'exercise')).toBe('watch')
    expect(level(nominal({ missedExerciseDays: 4 }), 'exercise')).toBe('act')
  })
  it('reaction time: watch when 20% slower than baseline', () => {
    expect(ids(nominal({ reactionMs: 311 }))).not.toContain('reaction')
    expect(level(nominal({ reactionMs: 313 }), 'reaction')).toBe('watch')
  })
})
