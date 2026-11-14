import { describe, expect, it } from 'vitest'
import { CREW } from './crew'
import { MIN_PER_DAY, START_MIN, commsDelaySec, dayOf, formatDelay, minuteOfDay } from './mission'
import {
  activityAt,
  bodySeries,
  cabinAt,
  dayRecord,
  doseRateAt,
  missedExerciseDays,
  missionDose,
  sleepStats,
  snapshot,
  vitalsAt,
} from './model'
import { hash01, smoothNoise } from './random'
import { NO_SCENARIOS } from './scenarios'

const crew = CREW[0]
const now = START_MIN
const today = dayOf(now)

describe('random', () => {
  it('gives the same value for the same seed and index', () => {
    expect(hash01(7, 42)).toBe(hash01(7, 42))
  })
  it('stays inside 0 to 1', () => {
    for (let i = 0; i < 500; i++) {
      const v = hash01(3, i)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
  it('smooth noise stays inside -1 to 1', () => {
    for (let i = 0; i < 500; i++) {
      expect(Math.abs(smoothNoise(5, i * 0.37, 3))).toBeLessThanOrEqual(1)
    }
  })
})

describe('mission clock', () => {
  it('starts the demo on day 143 at 09:40', () => {
    expect(today).toBe(143)
    expect(minuteOfDay(now)).toBe(9 * 60 + 40)
  })
  it('comms delay grows through the transit and never passes 20 minutes', () => {
    let last = -1
    for (let d = 0; d <= 210; d += 5) {
      const delay = commsDelaySec(d * MIN_PER_DAY)
      expect(delay).toBeGreaterThanOrEqual(last)
      expect(delay).toBeLessThanOrEqual(20 * 60)
      last = delay
    }
  })
  it('formats a delay in minutes and seconds', () => {
    expect(formatDelay(700)).toBe('11 min 40 s')
    expect(formatDelay(45)).toBe('45 s')
  })
})

describe('day records', () => {
  it('are identical when asked for twice', () => {
    expect(dayRecord(crew, 100, NO_SCENARIOS)).toEqual(dayRecord(crew, 100, NO_SCENARIOS))
  })
  it('keep sleep within a plausible range', () => {
    for (let d = 1; d <= today; d++) {
      const r = dayRecord(crew, d, NO_SCENARIOS)
      expect(r.sleepHours).toBeGreaterThan(4)
      expect(r.sleepHours).toBeLessThan(9.5)
      expect(r.sleepEnd - r.sleepStart).toBeCloseTo(r.sleepHours * 60, 5)
    }
  })
  it('differ between crew members', () => {
    expect(dayRecord(CREW[0], 50, NO_SCENARIOS)).not.toEqual(dayRecord(CREW[1], 50, NO_SCENARIOS))
  })
  it('a week of short sleep raises sleep debt', () => {
    const normal = sleepStats(crew, today, NO_SCENARIOS)
    const short = sleepStats(crew, today, { ...NO_SCENARIOS, shortSleep: now })
    expect(short.debt7).toBeGreaterThan(normal.debt7 + 8)
    expect(short.avg7).toBeLessThan(5.5)
  })
  it('missed exercise zeroes the previous four days', () => {
    const sc = { ...NO_SCENARIOS, missedExercise: now }
    expect(dayRecord(crew, today - 1, sc).cardioDone).toBe(0)
    expect(dayRecord(crew, today - 4, sc).resistanceDone).toBe(0)
    expect(missedExerciseDays(crew, today, sc)).toBe(4)
    expect(missedExerciseDays(crew, today, NO_SCENARIOS)).toBeLessThan(2)
  })
})

describe('vitals', () => {
  it('heart rate is lower asleep than during cardio', () => {
    const rec = dayRecord(crew, today, NO_SCENARIOS)
    const dayStart = (today - 1) * MIN_PER_DAY
    const asleep = dayStart + 180
    const cardio = dayStart + rec.cardioStart + 15
    expect(activityAt(crew, asleep, NO_SCENARIOS)).toBe('sleep')
    expect(activityAt(crew, cardio, NO_SCENARIOS)).toBe('cardio')
    expect(vitalsAt(crew, asleep, NO_SCENARIOS).heartRate).toBeLessThan(
      vitalsAt(crew, cardio, NO_SCENARIOS).heartRate - 40,
    )
  })
  it('blood oxygen stays between 92 and 100 in normal conditions', () => {
    for (let i = 0; i < 300; i++) {
      const v = vitalsAt(crew, now + i * 7, NO_SCENARIOS)
      expect(v.spo2).toBeGreaterThanOrEqual(92)
      expect(v.spo2).toBeLessThanOrEqual(100)
    }
  })
  it('flags an irregular rhythm only when that scenario is running', () => {
    expect(vitalsAt(crew, now, NO_SCENARIOS).irregular).toBe(false)
    expect(vitalsAt(crew, now + 1, { ...NO_SCENARIOS, irregularHeart: now }).irregular).toBe(true)
  })
})

describe('cabin', () => {
  it('holds CO2 in the normal band', () => {
    for (let i = 0; i < 200; i++) {
      const c = cabinAt(now + i * 11, NO_SCENARIOS)
      expect(c.co2).toBeGreaterThan(1.5)
      expect(c.co2).toBeLessThan(3)
    }
  })
  it('CO2 climbs past 4 mmHg three hours into a scrubber fault', () => {
    expect(cabinAt(now + 180, { ...NO_SCENARIOS, co2Rise: now }).co2).toBeGreaterThan(4)
  })
})

describe('radiation', () => {
  it('mission dose only goes up', () => {
    let last = 0
    for (let d = 1; d <= 210; d += 3) {
      const dose = missionDose(crew, d * MIN_PER_DAY, NO_SCENARIOS)
      expect(dose).toBeGreaterThan(last)
      last = dose
    }
  })
  it('is about 1.8 mSv a day by day 143', () => {
    const dose = missionDose(crew, now, NO_SCENARIOS)
    expect(dose).toBeGreaterThan(230)
    expect(dose).toBeLessThan(285)
  })
  it('a solar storm multiplies the dose rate and adds dose', () => {
    const sc = { ...NO_SCENARIOS, solarStorm: now }
    expect(doseRateAt(now + 60, sc)).toBeGreaterThan(doseRateAt(now + 60, NO_SCENARIOS) * 5)
    expect(missionDose(crew, now + 600, sc)).toBeGreaterThan(missionDose(crew, now + 600, NO_SCENARIOS) + 2)
  })
  it('the storm is over a day later', () => {
    const sc = { ...NO_SCENARIOS, solarStorm: now }
    expect(doseRateAt(now + MIN_PER_DAY, sc)).toBeLessThan(3)
  })
})

describe('body trends', () => {
  it('bone and muscle decline slowly with exercise and faster without', () => {
    const series = bodySeries(crew, today, NO_SCENARIOS)
    const last = series[series.length - 1]
    expect(series).toHaveLength(today)
    expect(last.bone).toBeLessThan(0)
    expect(last.bone).toBeGreaterThan(-4)
    const lazy = bodySeries(crew, today, { ...NO_SCENARIOS, missedExercise: now })
    expect(lazy[lazy.length - 1].bone).toBeLessThan(last.bone)
  })
})

describe('snapshot', () => {
  it('collects everything the alert rules need', () => {
    const s = snapshot(crew, now, NO_SCENARIOS)
    expect(s.day).toBe(143)
    expect(s.careerDose).toBeGreaterThan(missionDose(crew, now, NO_SCENARIOS))
    expect(s.vitals.heartRate).toBeGreaterThan(30)
    expect(s.cabin.o2).toBeGreaterThan(19)
  })
})
