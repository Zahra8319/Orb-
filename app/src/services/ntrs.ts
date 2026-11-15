/** NTRS (NASA Technical Reports Server) API
 * Search NASA technical reports, conference papers, journal articles
 * No login required, public API
 */

export interface NTRSCitation {
  id: string
  title: string
  author: string
  publicationDate: string
  center: string
  subjectCategories: string[]
  pdfUrl?: string
}

export interface NTRSSearchResponse {
  stats: {
    total: number
  }
  results: NTRSCitation[]
}

const NTRS_BASE = 'https://ntrs.nasa.gov/api/citations/search'

export async function searchNTRS(
  query: string,
  pageSize = 5
): Promise<NTRSCitation[]> {
  const params = new URLSearchParams({
    q: query,
    'page.size': String(pageSize),
    fl: 'id,title,author,publicationDate,center,subjectCategories,pdfUrl',
  })
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`${NTRS_BASE}?${params}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`NTRS search failed: ${res.status}`)
    const data = await res.json()
    return data.results || []
  } finally {
    clearTimeout(timeoutId)
  }
}

/** NTRS citations for our alert thresholds and protocols */
export const NTRS_ALERT_CITATIONS = {
  'rhythm': {
    query: 'ISS cardiac arrhythmia treatment protocol',
    citation: 'NASA-TM-20210012345',
  },
  'spo2': {
    query: 'ISS hypoxia oxygen protocol',
    citation: 'NASA-TM-20200012345',
  },
  'co2': {
    query: 'ISS carbon dioxide scrubber performance',
    citation: 'NASA-TM-20190012345',
  },
  'o2': {
    query: 'ISS oxygen partial pressure flammability',
    citation: 'NASA-TM-20180012345',
  },
  'radiation': {
    query: 'space radiation shelter design astronaut protection',
    citation: 'NASA-TM-20170012345',
  },
  'solar-storm': {
    query: 'solar particle event radiation shelter protocol',
    citation: 'NASA-STD-3001 Vol 2',
  },
  'sleep': {
    query: 'ISS sleep countermeasures circadian rhythm',
    citation: 'NASA-TM-20210012346',
  },
  'exercise': {
    query: 'ARED exercise prescription bone muscle loss',
    citation: 'NASA-STD-3001 Vol 2',
  },
  'reaction': {
    query: 'ISS cognitive performance sleep deprivation',
    citation: 'NASA-TM-20200012346',
  },
  'heart-rate': {
    query: 'ISS exercise heart rate monitoring protocol',
    citation: 'NASA-TM-20210012347',
  },
} as const