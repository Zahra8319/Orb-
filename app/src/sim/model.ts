/** The simulated crew and ship. Everything here is a pure function of (crew, time, scenarios),
 *  so the same moment always produces the same numbers. Nothing here is real telemetry. */

import type { Crew } from './crew'
import { DOSE_PER_DAY_MSV, MIN_PER_DAY, dayOf, minuteOfDay } from './mission'
import { hash01, smoothNoise } from './random'
import type { Scenarios } from './scenarios'

export type Activity = 'sleep' | 'cardio' | 'resistance' | 'awake'

export interface DayRecord {
  day: number
  /** Start of the night that ends on this day, in minutes from this day's midnight (usually negative). */
  sleepStart: number
  /** Wake-up time, minutes from midnight. */
  sleepEnd: number
  sleepHours: number
  cardioStart: number
  cardioPlanned: number
  cardioDone: number
  resistanceStart: number
  resistancePlanned: number
  resistanceDone: number
  /** Self-reported mood, 1 (low) to 5 (great). */
  mood: number
  reactionMs: number
  restingHr: number
  systolic: number
  diastolic: number
}

export interface Vitals {
  heartRate: number
  spo2: number
  breathing: number
  skinTemp: number
  irregular: boolean
  activity: Activity
}

export interface Cabin {
  /** Partial pressure of CO2, mmHg. */
  co2: number
  /** Partial pressure of oxygen, kPa. */
  o2: number
  /** Total cabin pressure, kPa. */
  pressure: number
  /** Degrees Celsius. */
  temperature: number
  /** Relative humidity, percent. */
  humidity: number
  /** Sound level, dBA. */
  noise: number
}

export interface Snapshot {
  day: number
  minuteOfDay: number
  vitals: Vitals
  cabin: Cabin
  /** Current dose rate in the cabin, mSv per day. */
  doseRate: number
  baseDoseRate: number
  missionDose: number
  /** Mission dose plus dose from earlier flights. */
  careerDose: number
  sleepAvg7: number
  sleepDebt7: number
  missedExerciseDays: number
  reactionMs: number
  reactionBaselineMs: number
  eyeCheckDue: boolean
  sheltered: boolean
}

export interface UserInput {
  sheltered?: boolean
  /** Result of a reaction test taken today, if any. */
  reactionMs?: number
  eyeCheckDone?: boolean
}

export const CARDIO_PLANNED = 40
export const RESISTANCE_PLANNED = 60
const SHORT_SLEEP_NIGHTS = 7
const MISSED_EXERCISE_DAYS = 4
const STORM_HOURS = 12
const STORM_PEAK = 16
const STORM_RISE_H = 0.75
const STORM_DECAY_H = 3.2
const CO2_RISE_PER_HOUR = 0.7

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round1 = (v: number) => Math.round(v * 10) / 10

/* ---------- sleep ---------- */

function inShortSleep(day: number, sc: Scenarios): boolean {
  if (sc['short-sleep'] === null) return false
  const trigger = dayOf(sc['short-sleep'] as number)
  return day > trigger - SHORT_SLEEP_NIGHTS && day <= trigger
}

function inMissedExercise(day: number, sc: Scenarios): boolean {
  if (sc['missed-exercise'] === null) return false
  const trigger = dayOf(sc['missed-exercise'] as number)
  return day >= trigger - MISSED_EXERCISE_DAYS && day < trigger
}

/** Usual wake-up time for this crew member, minutes from midnight. */
export function usualWake(crew: Crew): number {
  return crew.bedtime + crew.sleepNeed * 60 - MIN_PER_DAY
}

function sleepNight(crew: Crew, day: number, sc: Scenarios) {
  const s = crew.seed
  const hours = inShortSleep(day, sc)
    ? 4.3 + hash01(s + 101, day) * 0.7
    : crew.sleepNeed + (hash01(s + 1, day) - 0.62) * 1.5
  const sleepEnd = usualWake(crew) + Math.round((hash01(s + 2, day) - 0.5) * 30)
  return { sleepHours: hours, sleepEnd, sleepStart: sleepEnd - hours * 60 }
}

function debtOver(crew: Crew, day: number, nights: number, sc: Scenarios): number {
  let debt = 0
  for (let d = day; d > day - nights && d >= 1; d--) {
    debt += Math.max(0, crew.sleepNeed - sleepNight(crew, d, sc).sleepHours)
  }
  return debt
}

/* ---------- day records ---------- */

const dayCache = new Map<string, DayRecord>()
const scKey = (sc: Scenarios) =>
  `${sc['short-sleep'] === null ? '-' : dayOf(sc['short-sleep'] as number)}|${sc['missed-exercise'] === null ? '-' : dayOf(sc['missed-exercise'] as number)}`

export function dayRecord(crew: Crew, day: number, sc: Scenarios): DayRecord {
  const key = `${crew.id}:${day}:${scKey(sc)}`
  const cached = dayCache.get(key)
  if (cached) return cached

  const s = crew.seed
  const night = sleepNight(crew, day, sc)
  const debt3 = debtOver(crew, day, 3, sc)

  const skipped = inMissedExercise(day, sc)
  const full = (seed: number) => hash01(seed, day) < crew.exerciseHabit
  const partial = (seed: number) => 0.55 + hash01(seed, day) * 0.3
  const cardioDone = skipped ? 0 : Math.round(CARDIO_PLANNED * (full(s + 3) ? 1 : partial(s + 4)))
  const resistanceDone = skipped ? 0 : Math.round(RESISTANCE_PLANNED * (full(s + 5) ? 1 : partial(s + 6)))

  const rec: DayRecord = {
    day,
    ...night,
    cardioStart: Math.round((usualWake(crew) + 90) / 10) * 10,
    cardioPlanned: CARDIO_PLANNED,
    cardioDone,
    resistanceStart: 16 * 60 + (crew.seed % 3) * 30,
    resistancePlanned: RESISTANCE_PLANNED,
    resistanceDone,
    mood: clamp(Math.round(3.9 + smoothNoise(s + 7, day, 5) * 0.9 - debt3 * 0.14), 1, 5),
    reactionMs: Math.round(crew.reactionBaselineMs + debt3 * 7 + (hash01(s + 8, day) * 2 - 1) * 10),
    restingHr: Math.round(crew.restingHr + smoothNoise(s + 9, day, 6) * 2 + debt3 * 0.6),
    systolic: Math.round(114 + (crew.seed % 7) + smoothNoise(s + 10, day, 4) * 5),
    diastolic: Math.round(73 + (crew.seed % 5) + smoothNoise(s + 12, day, 4) * 3),
  }
  dayCache.set(key, rec)
  return rec
}

export interface SleepStats {
  avg7: number
  debt7: number
  debt3: number
  /** How far the middle of recent sleep sits from this person's usual schedule, in minutes. Positive means late. */
  clockShiftMin: number
}

export function sleepStats(crew: Crew, day: number, sc: Scenarios): SleepStats {
  let total = 0
  let count = 0
  for (let d = day; d > day - 7 && d >= 1; d--) {
    total += dayRecord(crew, d, sc).sleepHours
    count++
  }
  const idealMid = usualWake(crew) - crew.sleepNeed * 30
  let shift = 0
  let n = 0
  for (let d = day; d > day - 3 && d >= 1; d--) {
    const r = dayRecord(crew, d, sc)
    shift += (r.sleepStart + r.sleepEnd) / 2 - idealMid
    n++
  }
  return {
    avg7: total / count,
    debt7: debtOver(crew, day, 7, sc),
    debt3: debtOver(crew, day, 3, sc),
    clockShiftMin: Math.round(shift / n),
  }
}

/** Days in a row, ending yesterday, with less than half the prescribed exercise. */
export function missedExerciseDays(crew: Crew, day: number, sc: Scenarios): number {
  let missed = 0
  for (let d = day - 1; d >= 1; d--) {
    const r = dayRecord(crew, d, sc)
    const share = (r.cardioDone + r.resistanceDone) / (r.cardioPlanned + r.resistancePlanned)
    if (share >= 0.5) break
    missed++
  }
  return missed
}

/** Exercise completed so far today. */
export function exerciseSoFar(crew: Crew, t: number, sc: Scenarios) {
  const rec = dayRecord(crew, dayOf(t), sc)
  const m = minuteOfDay(t)
  return {
    cardioDone: clamp(m - rec.cardioStart, 0, rec.cardioDone),
    resistanceDone: clamp(m - rec.resistanceStart, 0, rec.resistanceDone),
    cardioPlanned: rec.cardioPlanned,
    resistancePlanned: rec.resistancePlanned,
  }
}

export function eyeCheckDue(crew: Crew, day: number): boolean {
  return (day + crew.eyeCheckOffset) % 14 === 0
}

/** The next day an eye check falls due, counting today. */
export function nextEyeCheck(crew: Crew, day: number): number {
  let d = day
  while (!eyeCheckDue(crew, d)) d++
  return d
}

/* ---------- live vitals ---------- */

export function activityAt(crew: Crew, t: number, sc: Scenarios): Activity {
  const day = dayOf(t)
  const m = minuteOfDay(t)
  const rec = dayRecord(crew, day, sc)
  if (m >= rec.sleepStart && m < rec.sleepEnd) return 'sleep'
  if (m >= dayRecord(crew, day + 1, sc).sleepStart + MIN_PER_DAY) return 'sleep'
  if (m >= rec.cardioStart && m < rec.cardioStart + rec.cardioDone) return 'cardio'
  if (m >= rec.resistanceStart && m < rec.resistanceStart + rec.resistanceDone) return 'resistance'
  return 'awake'
}

export function vitalsAt(crew: Crew, t: number, sc: Scenarios): Vitals {
  const s = crew.seed
  const activity = activityAt(crew, t, sc)
  const rec = dayRecord(crew, dayOf(t), sc)
  const m = minuteOfDay(t)
  const wobble = smoothNoise(s + 20, t, 9) * 3 + smoothNoise(s + 21, t, 0.8) * 2

  let heartRate: number
  let breathing: number
  if (activity === 'sleep') {
    heartRate = rec.restingHr - 6 + wobble * 0.6
    breathing = 12 + smoothNoise(s + 22, t, 6)
  } else if (activity === 'cardio') {
    const ramp = clamp((m - rec.cardioStart) / 4, 0, 1)
    heartRate = rec.restingHr + 8 + ramp * (136 - rec.restingHr) + wobble
    breathing = 16 + ramp * 14 + smoothNoise(s + 22, t, 3) * 2
  } else if (activity === 'resistance') {
    const ramp = clamp((m - rec.resistanceStart) / 4, 0, 1)
    heartRate = rec.restingHr + 8 + ramp * (104 - rec.restingHr) + wobble * 2.5
    breathing = 16 + ramp * 5 + smoothNoise(s + 22, t, 3) * 2
  } else {
    heartRate = rec.restingHr + 8 + wobble
    breathing = 14.5 + smoothNoise(s + 22, t, 5) * 1.5
  }

  // 'irregular-heart' affects whoever is signed in; the 'arrhythmia' case is the commander's.
  const started = (at: number | null) => at !== null && t >= at
  const irregular = started(sc['irregular-heart']) || (crew.id === 'okafor' && started(sc.arrhythmia))
  if (irregular) {
    // Erratic beat-to-beat jumps, re-rolled every nine seconds.
    heartRate += 14 + (hash01(s + 23, t / 0.15) * 2 - 1) * 26
  }

  const co2 = cabinAt(t, sc).co2
  const spo2 = 97.6 + smoothNoise(s + 24, t, 12) * 0.9 - (co2 > 5 ? (co2 - 5) * 0.8 : 0)
  const circadian = Math.sin(((m - 600) / MIN_PER_DAY) * 2 * Math.PI)

  return {
    heartRate: Math.round(heartRate),
    spo2: clamp(Math.round(spo2), 80, 100),
    breathing: Math.round(breathing),
    skinTemp: round1(36.4 + circadian * 0.3 + smoothNoise(s + 25, t, 30) * 0.1),
    irregular,
    activity,
  }
}

/* ---------- cabin ---------- */

export function cabinAt(t: number, sc: Scenarios): Cabin {
  const m = minuteOfDay(t)
  const shipDay = m >= 6 * 60 && m < 22 * 60
  let co2 = 2.4 + smoothNoise(901, t, 45) * 0.35 + smoothNoise(902, t, 6) * 0.1
  if (sc['co2-rise'] !== null && t >= (sc['co2-rise'] as number)) {
    co2 = Math.min(7.6, co2 + ((t - (sc['co2-rise'] as number)) / 60) * CO2_RISE_PER_HOUR)
  }
  return {
    co2: round1(co2),
    o2: round1(21.2 + smoothNoise(903, t, 120) * 0.25),
    pressure: round1(101.3 + smoothNoise(904, t, 200) * 0.3),
    temperature: round1(22.5 + smoothNoise(905, t, 180) * 0.6),
    humidity: Math.round(45 + smoothNoise(906, t, 150) * 5),
    noise: Math.round((shipDay ? 58 : 51) + smoothNoise(907, t, 20) * 3),
  }
}

/* ---------- radiation ---------- */

function stormMultiplier(t: number, sc: Scenarios): number {
  if (sc['solar-storm'] === null) return 0
  const h = (t - (sc['solar-storm'] as number)) / 60
  if (h < 0 || h > STORM_HOURS) return 0
  const rise = Math.min(1, h / STORM_RISE_H)
  const decay = Math.exp(-Math.max(0, h - STORM_RISE_H) / STORM_DECAY_H)
  return STORM_PEAK * rise * decay
}

/** Integral of the storm multiplier from the start of the storm, in multiplier-hours. */
function stormIntegral(hours: number): number {
  const h = clamp(hours, 0, STORM_HOURS)
  if (h <= STORM_RISE_H) return (STORM_PEAK * h * h) / (2 * STORM_RISE_H)
  const rise = (STORM_PEAK * STORM_RISE_H) / 2
  return rise + STORM_PEAK * STORM_DECAY_H * (1 - Math.exp(-(h - STORM_RISE_H) / STORM_DECAY_H))
}

/** Dose rate measured in the cabin right now, mSv per day. */
export function doseRateAt(t: number, sc: Scenarios): number {
  const background = DOSE_PER_DAY_MSV * (1 + smoothNoise(950, t, 90) * 0.06)
  return background * (1 + stormMultiplier(t, sc))
}

/** Hours until the current storm is expected to fall back under the alert level. 0 when no storm. */
export function stormHoursLeft(t: number, sc: Scenarios): number {
  if (sc['solar-storm'] === null) return 0
  const end = (sc['solar-storm'] as number) + STORM_HOURS * 60
  return t >= (sc['solar-storm'] as number) && t < end ? (end - t) / 60 : 0
}

function dayDose(crew: Crew, day: number): number {
  return DOSE_PER_DAY_MSV * crew.doseFactor * (1 + (hash01(991, day) * 2 - 1) * 0.12)
}

const dosePrefix = new Map<string, number[]>()
function doseBefore(crew: Crew, day: number): number {
  let prefix = dosePrefix.get(crew.id)
  if (!prefix) {
    prefix = [0]
    dosePrefix.set(crew.id, prefix)
  }
  while (prefix.length < day) prefix.push(prefix[prefix.length - 1] + dayDose(crew, prefix.length))
  return prefix[Math.max(0, day - 1)]
}

/** Dose this crew member has absorbed since launch, in mSv. */
export function missionDose(crew: Crew, t: number, sc: Scenarios): number {
  const day = dayOf(t)
  const background = doseBefore(crew, day) + dayDose(crew, day) * (minuteOfDay(t) / MIN_PER_DAY)
  const storm =
    sc['solar-storm'] === null
      ? 0
      : (DOSE_PER_DAY_MSV / 24) * crew.doseFactor * stormIntegral((t - (sc['solar-storm'] as number)) / 60)
  return background + storm
}

/* ---------- long-term body changes ---------- */

export interface BodyPoint {
  day: number
  /** Estimated change in hip bone density since launch, percent. */
  bone: number
  /** Estimated change in leg muscle strength since launch, percent. */
  muscle: number
}

const bodyCache = new Map<string, BodyPoint[]>()

/** Estimated bone and muscle change for each day of the mission so far.
 *  Loss runs about 1.25% a month for bone with no exercise, and about a third of that with full exercise. */
export function bodySeries(crew: Crew, day: number, sc: Scenarios): BodyPoint[] {
  const key = `${crew.id}:${day}:${scKey(sc)}`
  const cached = bodyCache.get(key)
  if (cached) return cached
  const series: BodyPoint[] = []
  let bone = 0
  let muscle = 0
  for (let d = 1; d <= day; d++) {
    const r = dayRecord(crew, d, sc)
    const adherence = (r.cardioDone + r.resistanceDone) / (r.cardioPlanned + r.resistancePlanned)
    bone -= (1.25 - 0.9 * adherence) / 30
    muscle -= (1.6 - 1.2 * adherence) / 30
    series.push({ day: d, bone, muscle })
  }
  if (bodyCache.size > 40) bodyCache.clear()
  bodyCache.set(key, series)
  return series
}

/** Average exercise adherence so far (0-1). */
export function averageAdherence(crew: Crew, day: number, sc: Scenarios): number {
  let totalAdherence = 0
  let count = 0
  for (let d = 1; d <= day; d++) {
    const r = dayRecord(crew, d, sc)
    totalAdherence += (r.cardioDone + r.resistanceDone) / (r.cardioPlanned + r.resistancePlanned)
    count++
  }
  return count > 0 ? totalAdherence / count : 1
}

/** Projected bone/muscle loss at mission end given current adherence. */
export function projectBodyAtMissionEnd(crew: Crew, day: number, sc: Scenarios): { bone: number; muscle: number } {
  const body = bodySeries(crew, day, sc)
  const current = body[body.length - 1]
  const remainingDays = 210 - day // MISSION_DAYS
  const adherence = averageAdherence(crew, day, sc)
  const boneLossPerDay = (1.25 - 0.9 * adherence) / 30
  const muscleLossPerDay = (1.6 - 1.2 * adherence) / 30
  return {
    bone: current.bone - boneLossPerDay * remainingDays,
    muscle: current.muscle - muscleLossPerDay * remainingDays,
  }
}

/** Projected series for charting (historical + projected). */
export function projectedBodySeries(crew: Crew, day: number, sc: Scenarios): BodyPoint[] {
  const historical = bodySeries(crew, day, sc)
  const projected: BodyPoint[] = []
  let bone = historical[historical.length - 1]?.bone ?? 0
  let muscle = historical[historical.length - 1]?.muscle ?? 0
  const adherence = averageAdherence(crew, day, sc)
  const boneLossPerDay = (1.25 - 0.9 * adherence) / 30
  const muscleLossPerDay = (1.6 - 1.2 * adherence) / 30
  for (let d = day + 1; d <= 210; d++) {
    bone -= boneLossPerDay
    muscle -= muscleLossPerDay
    projected.push({ day: d, bone, muscle })
  }
  return [...historical, ...projected]
}

/** Projected no-exercise series for comparison. */
export function projectedNoExerciseSeries(_crew: Crew, day: number): BodyPoint[] {
  const projected: BodyPoint[] = []
  let bone = (-1.25 / 30) * day
  for (let d = day + 1; d <= 210; d++) {
    bone -= 1.25 / 30
    projected.push({ day: d, bone, muscle: 0 })
  }
  return projected
}

/* ---------- snapshot for the alert rules ---------- */

export function snapshot(crew: Crew, t: number, sc: Scenarios, user: UserInput = {}): Snapshot {
  const day = dayOf(t)
  const sleep = sleepStats(crew, day, sc)
  const mission = missionDose(crew, t, sc)
  return {
    day,
    minuteOfDay: minuteOfDay(t),
    vitals: vitalsAt(crew, t, sc),
    cabin: cabinAt(t, sc),
    doseRate: doseRateAt(t, sc),
    baseDoseRate: DOSE_PER_DAY_MSV,
    missionDose: mission,
    careerDose: mission + crew.priorDoseMsv,
    sleepAvg7: sleep.avg7,
    sleepDebt7: sleep.debt7,
    missedExerciseDays: missedExerciseDays(crew, day, sc),
    reactionMs: user.reactionMs ?? dayRecord(crew, day, sc).reactionMs,
    reactionBaselineMs: crew.reactionBaselineMs,
    eyeCheckDue: eyeCheckDue(crew, day) && !user.eyeCheckDone,
    sheltered: user.sheltered ?? false,
  }
}
