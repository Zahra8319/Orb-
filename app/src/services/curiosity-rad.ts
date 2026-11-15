/** Curiosity RAD (Radiation Assessment Detector) - Mars surface radiation data
 * NASA PDS Planetary Plasma Interactions Node
 * Public data, no login required
 */

export interface RADFile {
  fileName: string
  startTime: string
  stopTime: string
  fileSize: number
}

export interface RADMeasurement {
  timestamp: string
  doseRate: number // mSv/day
  doseRateError: number
  particleFlux: number
}

/** RAD baseline dose rate from Mars surface (mSv/day) */
export const CURISOTY_RAD_BASELINE_MSv_PER_DAY = 0.64 // Average from RAD measurements

/** Fetch RAD index file listing */
export async function fetchRADIndex(): Promise<RADFile[]> {
  const base = 'https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/'
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(base + 'INDEX/INDEX.TAB', { signal: controller.signal })
    if (!response.ok) throw new Error('Failed to fetch RAD index')
    const text = await response.text()
    return parseRADIndex(text)
  } finally {
    clearTimeout(timeoutId)
  }
}

function parseRADIndex(text: string): RADFile[] {
  const lines = text.split('\n').filter(l => l.trim())
  // INDEX.TAB is tab-separated; simplified parsing
  return lines.slice(1).map(line => {
    const parts = line.split(/\t+/)
    return {
      fileName: parts[0]?.trim() || '',
      startTime: parts[1]?.trim() || '',
      stopTime: parts[2]?.trim() || '',
      fileSize: parseInt(parts[3]?.trim() || '0', 10),
    }
  }).filter(f => f.fileName)
}

/** Get average Mars surface dose rate from RAD data
 * Returns baseline mSv/day for deep space transit calculations
 */
export function getCuriosityRADBaseline(): number {
  return CURISOTY_RAD_BASELINE_MSv_PER_DAY
}

/** Mars transit dose rate is typically 1.8 mSv/day (Curiosity cruise + surface average) */
export const MARS_TRANSIT_DOSE_RATE_MSv_PER_DAY = 1.8

/** Radiation quality factor for different particle types */
export const RADIATION_QUALITY_FACTORS = {
  proton: 1,
  helium: 2,
  heavier: 5,
  neutron: 10,
} as const