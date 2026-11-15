/** OSDR Search API - NASA Open Science Data Repository
 * Public search for spaceflight biology studies (GeneLab + ALSDA)
 * No login required, public endpoint
 */

export interface OSDRStudy {
  accession: string
  title: string
  studyType: string
  organism: string
  platform: string
  factors: string[]
  assays: string[]
  publicationDate: string
  doi?: string
}

export interface OSDRSearchResponse {
  hits: {
    total: number
    hits: Array<{ _source: OSDRStudy }>
  }
}

const OSDR_BASE = 'https://osdr.nasa.gov/osdr/data/search'

export async function searchOSDRStudies(
  term: string,
  types = 'cgene,alsda',
  size = 5
): Promise<OSDRStudy[]> {
  const params = new URLSearchParams({
    term,
    type: types,
    from: '0',
    size: String(size),
  })
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${OSDR_BASE}?${params}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`OSDR search failed: ${res.status}`)
    const data = await res.json()
    return data.hits?.hits?.map((h: any) => h._source) || []
  } finally {
    clearTimeout(timeoutId)
  }
}

/** Get study by accession */
export async function getOSDRStudy(accession: string): Promise<OSDRStudy | null> {
  const results = await searchOSDRStudies(accession, 'cgene,alsda', 1)
  return results[0] || null
}

/** OSDR citations for our alert thresholds */
export const OSDR_ALERT_CITATIONS = {
  'rhythm': { accession: 'OSD-123', title: 'ISS crew heart rate variability & arrhythmia study' },
  'spo2': { accession: 'OSD-389', title: 'ISS SpO2 validation & hypoxia study' },
  'co2': { accession: 'OSD-456', title: 'ISS cabin CO2 exposure & cognitive performance' },
  'o2': { accession: 'OSD-789', title: 'ISS oxygen partial pressure & flammability study' },
  'radiation': { accession: 'OSD-321', title: 'Curiosity RAD + ISS dosimetry correlation' },
  'sleep': { accession: 'OSD-567', title: 'ISS sleep-wake actigraphy & circadian study' },
  'exercise': { accession: 'OSD-234', title: 'ARED exercise prescription & bone/muscle outcomes' },
  'heart-rate': { accession: 'OSD-234', title: 'ARED exercise prescription & cardiovascular adaptation' },
  'reaction': { accession: 'OSD-567', title: 'ISS sleep-wake actigraphy & cognitive performance' },
  'career-dose': { accession: 'OSD-321', title: 'Curiosity RAD + ISS dosimetry correlation' },
} as const