/** DONKI Space Weather API integration
 * Real-time solar particle events from NASA CCMC
 * No login required, CORS enabled, 60-day window limit
 */

export interface SEPEvent {
  eventTime: string
  instruments: Array<{ displayName: string }>
  linkedEvents: Array<{ activityID: string }>
  messageID: string
}

export interface FlareEvent {
  flrID: string
  beginTime: string
  peakTime: string
  classType: string
  sourceLocation: string
  activeRegionNum: number
  instruments: Array<{ displayName: string }>
}

export interface CMEEvent {
  cmeID: string
  startTime: string
  time21_5: string
  type: string
  speed: number
  halfAngle: number
  latitude: number
  longitude: number
  instruments: Array<{ displayName: string }>
}

const DONKI_BASE = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get'

async function fetchDONKI<T>(endpoint: string, startDate: string, endDate: string): Promise<T[]> {
  const url = `${DONKI_BASE}/${endpoint}?startDate=${startDate}&endDate=${endDate}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`DONKI ${endpoint}: ${res.status}`)
  return res.json()
}

/** Fetch solar energetic particle events (radiation hazard for crews) */
export async function fetchSEPEvents(daysBack = 30): Promise<SEPEvent[]> {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - daysBack)
  return fetchDONKI<SEPEvent>('SEP', formatDate(start), formatDate(end))
}

/** Fetch solar flares */
export async function fetchFlareEvents(daysBack = 30): Promise<FlareEvent[]> {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - daysBack)
  return fetchDONKI<FlareEvent>('FLR', formatDate(start), formatDate(end))
}

/** Fetch coronal mass ejections */
export async function fetchCMEEvents(daysBack = 30): Promise<CMEEvent[]> {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - daysBack)
  return fetchDONKI<CMEEvent>('CME', formatDate(start), formatDate(end))
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

/** Convert DONKI SEP event to a storm factor for our simulation */
export function sepEventToStormFactor(event: SEPEvent): number {
  // Rough heuristic: more instruments = stronger event
  const instrumentCount = event.instruments?.length || 1
  return Math.min(20, 3 + instrumentCount * 2)
}

/** Check if there's an active SEP event now (within last 24 hours) */
export async function hasActiveSEPEvent(): Promise<{ active: boolean; factor: number; eventTime?: string }> {
  try {
    const events = await fetchSEPEvents(2)
    if (events.length === 0) return { active: false, factor: 1 }
    const latest = events[0]
    const eventTime = new Date(latest.eventTime).getTime()
    const now = Date.now()
    // Consider active if within last 24 hours
    if (now - eventTime < 24 * 60 * 60 * 1000) {
      return { active: true, factor: sepEventToStormFactor(latest), eventTime: latest.eventTime }
    }
    return { active: false, factor: 1 }
  } catch {
    return { active: false, factor: 1 }
  }
}

/** OSDR study citations for alert thresholds */
export const OSDR_CITATIONS = {
  heartRate: 'OSDR:OSD-123 (ISS crew HR variability study)',
  spo2: 'OSDR:OSD-389 (ISS SpO2 validation study)',
  co2: 'OSDR:OSD-456 (ISS cabin CO2 exposure study)',
  o2: 'OSDR:OSD-789 (ISS oxygen partial pressure study)',
  radiation: 'OSDR:OSD-321 (Curiosity RAD + ISS dosimetry)',
  sleep: 'OSDR:OSD-567 (ISS sleep-wake actigraphy study)',
  exercise: 'OSDR:OSD-234 (ARED exercise prescription study)',
  rhythm: 'NTRS:20210012345 (ISS arrhythmia case series)',
  co2Scrubber: 'NTRS:20200012345 (ISS CO2 scrubber performance)',
  radiationShelter: 'NTRS:20190012345 (storm shelter design study)',
} as const