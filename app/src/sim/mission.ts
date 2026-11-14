/** Mission constants and clock helpers. Time is counted in minutes since launch. */

export const MIN_PER_DAY = 1440
export const MISSION_DAYS = 210

/** The demo opens on day 143 at 09:40 ship time. */
export const START_MIN = 142 * MIN_PER_DAY + 9 * 60 + 40

/** Average dose equivalent in deep-space transit, as measured by Curiosity's RAD on the way to Mars. */
export const DOSE_PER_DAY_MSV = 1.8
/** NASA career limit for space radiation exposure. */
export const CAREER_LIMIT_MSV = 600
/** Share of dose from neutrons, as reported for the ISS by the Canadian Space Agency. */
export const NEUTRON_SHARE = 0.3

const MAX_DELAY_SEC = 20 * 60

/** 1-based mission day. */
export function dayOf(t: number): number {
  return Math.floor(t / MIN_PER_DAY) + 1
}

export function minuteOfDay(t: number): number {
  return ((t % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY
}

export function dayStart(day: number): number {
  return (day - 1) * MIN_PER_DAY
}

/** One-way signal delay to Earth in seconds. Grows as the ship pulls away, up to 20 minutes at arrival. */
export function commsDelaySec(t: number): number {
  const progress = Math.min(1, Math.max(0, t / (MISSION_DAYS * MIN_PER_DAY)))
  return Math.round(MAX_DELAY_SEC * Math.pow(progress, 1.4))
}

export function formatDelay(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  const rest = s % 60
  if (m === 0) return `${rest} s`
  return `${m} min ${rest} s`
}

/** "09:40" from a minute of the day. */
export function formatClock(minute: number): string {
  const m = ((Math.floor(minute) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

/** "7 h 20 min" from a number of hours. */
export function formatHours(hours: number): string {
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}
