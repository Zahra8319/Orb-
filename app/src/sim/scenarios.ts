/** Scenario definitions that can be injected into the simulation. */

export interface Scenario {
  id: string
  name: string
  description: string
  /** When the scenario becomes active (mission day). null = not scheduled. */
  triggerDay: number | null
  /** How long the scenario runs, in days. */
  duration: number
  /** Severity for UI badging. */
  severity: 'minor' | 'moderate' | 'major' | 'critical'
  /** Category for grouping. */
  category: 'medical' | 'environmental' | 'system' | 'behavioral'
  /** Narrative text shown when scenario triggers. */
  narrative: string
  /** Clinical guidance for the crew. */
  guidance: string[]
  /**
   * True when starting it changes Orb's live readings and alerts. False for a
   * case file the crew trains on: the write-up shows, the readings do not move.
   */
  live: boolean
  /** Which alerts this scenario activates (empty for a case file). */
  triggersAlerts: string[]
  /** Callback to apply scenario effects to the simulation state. */
  apply?: (crew: any, day: number) => void
}

export interface MedicalScenario extends Scenario {
  category: 'medical'
  /** Patient crew member ID. */
  patientId: string
  /** Differential diagnosis options. */
  differential: string[]
  /** Recommended workup. */
  workup: string[]
  /** Treatment options with Earth-consult guidance. */
  treatment: {
    autonomous: string[]
    earthConsult: string[]
  }[]
  /** Disposition options. */
  disposition: string[]
}

export const SCENARIOS: Scenario[] = [
  // Environmental scenarios (existing)
  {
    id: 'solar-storm',
    name: 'Solar Particle Event',
    description: 'Major solar flare increases radiation dose rate 10-16x for 12 hours.',
    triggerDay: null,
    duration: 1,
    severity: 'critical',
    category: 'environmental',
    narrative: 'SOLAR STORM WARNING: X-class flare detected. Proton flux rising. Storm shelter protocol initiated.',
    guidance: [
      'Move to storm shelter immediately (water wall or dedicated shelter).',
      'Remain sheltered until dose rate falls below 5x background.',
      'Take potassium iodide 130 mg if thyroid dose projected > 50 mSv.',
      'Delay all EVA operations until all-clear.',
    ],
    live: true,
    triggersAlerts: ['solar-storm'],
  },
  {
    id: 'co2-rise',
    name: 'CO₂ Scrubber Degradation',
    description: 'Primary CO₂ scrubber failing, cabin CO₂ rising 0.7 mmHg/hr.',
    triggerDay: null,
    duration: 3,
    severity: 'major',
    category: 'environmental',
    narrative: 'CABIN ATMOSPHERE: CO₂ scrubber efficiency degraded to 60%. CO₂ rising.',
    guidance: [
      'Swap scrubber cartridge per procedure.',
      'Increase cabin fan speed to high.',
      'Avoid heavy exercise until CO₂ < 3 mmHg.',
      'Monitor for headache, dyspnea, cognitive slowing.',
    ],
    live: true,
    triggersAlerts: ['co2'],
  },
  {
    id: 'irregular-heart',
    name: 'New-Onset Atrial Fibrillation',
    description: 'Crew member develops irregularly irregular rhythm at 110-130 bpm.',
    triggerDay: null,
    duration: 7,
    severity: 'major',
    category: 'medical',
    narrative: 'MEDICAL EVENT: The signed-in crew member reports palpitations. ECG shows Afib with RVR.',
    guidance: [
      'Record 30-second ECG strip immediately.',
      'If hemodynamically stable: metoprolol 5 mg IV, recheck in 15 min.',
      'If unstable: synchronized cardioversion 50 J.',
      'Anticoagulation decision requires Earth consult (CHA₂DS₂-VASc).',
    ],
    live: true,
    triggersAlerts: ['rhythm'],
  },
  {
    id: 'short-sleep',
    name: 'A Week of Short Sleep',
    description: 'Seven nights of short, broken sleep before today.',
    triggerDay: null,
    duration: 7,
    severity: 'moderate',
    category: 'behavioral',
    narrative: 'SLEEP: The last seven nights were cut short by schedule pressure and noise. Sleep debt is building.',
    guidance: [
      'Protect an 8.5-hour sleep opportunity tonight.',
      'Dim cabin lights two hours before bed.',
      'Take the reaction-time test before any robotics or EVA work.',
      'Tell the commander if critical tasks fall in your low-alertness window.',
    ],
    live: true,
    triggersAlerts: ['sleep'],
  },
  {
    id: 'missed-exercise',
    name: 'Missed Exercise',
    description: 'Four days in a row without a full exercise session.',
    triggerDay: null,
    duration: 4,
    severity: 'moderate',
    category: 'medical',
    narrative: 'EXERCISE: No full cardio and resistance session for four days. Bone and muscle loss speed up without loading.',
    guidance: [
      'Resume the full plan today: cardio and resistance.',
      'Ramp resistance load back up over two sessions.',
      'Log any pain or equipment faults so the plan can be adjusted.',
    ],
    live: true,
    triggersAlerts: ['exercise'],
  },
  {
    id: 'behavioral-crisis',
    name: 'Behavioral Health Crisis',
    description: 'Crew member develops depression, isolation withdrawal, performance decline.',
    triggerDay: null,
    duration: 30,
    severity: 'major',
    category: 'behavioral',
    narrative: 'BEHAVIORAL ALERT: Tanaka has missed 5 exercise sessions in 7 days, sleep avg 4.2h, mood 1-2/5, withdrawn from crew meals. Reaction time 35% slower. Verbalized "what\'s the point" during conference.',
    guidance: [
      'Protected sleep: 8.5h opportunity, dark/quiet cabin',
      'Exercise prescription: mandatory daily cardio + resistance',
      'Bright light therapy: 10,000 lux × 30 min AM',
      'Sertraline 50 mg daily (if PHQ-9 ≥ 10, start after Earth consult)',
      'Mirtazapine 15 mg HS (if insomnia prominent)',
      'Structured daily schedule with meaningful tasks',
      'Crew buddy system: daily check-ins',
      'Private medical conference with flight surgeon',
      'Structured crew debrief (facilitated, no mission business)',
    ],
    live: false,
    triggersAlerts: [],
  },
]

// Medical scenarios with full clinical detail
export const MEDICAL_SCENARIOS: MedicalScenario[] = [
  {
    id: 'appendicitis',
    name: 'Acute Appendicitis',
    description: 'Crew member develops RLQ pain, fever, leukocytosis. Surgical emergency.',
    triggerDay: null,
    duration: 5,
    severity: 'critical',
    category: 'medical',
    patientId: 'lindqvist',
    narrative: 'MEDICAL EMERGENCY: Lindqvist reports severe RLQ pain × 6 hrs, nausea, fever 38.7°C. Guarding on exam. WBC 16,000.',
    differential: [
      'Acute appendicitis (most likely)',
      'Mesenteric adenitis',
      'Right-sided diverticulitis',
      'Renal colic',
      'Ovarian pathology (if applicable)',
    ],
    workup: [
      'Abdominal ultrasound (appendix diameter > 6 mm, non-compressible, periappendiceal fluid)',
      'CBC with differential (already elevated)',
      'CRP (elevated)',
      'Urinalysis (rule out renal)',
    ],
    treatment: [
      {
        autonomous: [
          'IV fluids 1L NS bolus',
          'Ceftriaxone 2 g IV q24h + metronidazole 500 mg IV q8h',
          'Morphine 4 mg IV q4h PRN pain',
          'Ondansetron 4 mg IV q6h PRN nausea',
          'NPO status, surgical prep',
        ],
        earthConsult: [
          'Confirm ultrasound findings with Earth radiology',
          'Discuss appendectomy vs. antibiotics-first strategy',
          'If antibiotics-first: piperacillin-tazobactam 3.375 g IV q6h',
          'Evacuation timeline if perforation suspected',
        ],
      },
    ],
    disposition: [
      'Antibiotics-first with close monitoring (if uncomplicated, early presentation)',
      'Emergency laparoscopic appendectomy (if perforated, abscess, or failing medical mgmt)',
      'Medical evacuation to Earth (not feasible in transit — must treat onboard)',
    ],
    live: false,
    triggersAlerts: [],
    guidance: [
      'This is the most common surgical emergency in space analog studies.',
      'Antibiotics-first succeeds in ~70% of uncomplicated cases.',
      'Perforation risk increases 5% per hour of delay after 24h.',
      'Crew medical officer can perform laparoscopic appendectomy with telementoring.',
    ],
  },
  {
    id: 'kidney-stone',
    name: 'Ureteral Calculus (Kidney Stone)',
    description: 'Crew member develops severe flank pain, hematuria. High risk in microgravity.',
    triggerDay: null,
    duration: 7,
    severity: 'major',
    category: 'medical',
    patientId: 'tanaka',
    narrative: 'MEDICAL EVENT: Tanaka reports sudden severe left flank pain radiating to groin, nausea, vomiting. Microscopic hematuria on dipstick.',
    differential: [
      'Ureteral calculus (most likely)',
      'Pyelonephritis',
      'Renal infarct',
      'Musculoskeletal strain',
    ],
    workup: [
      'Renal ultrasound (hydronephrosis, stone visualization)',
      'Urinalysis (hematuria, crystals, WBC)',
      'CBC, BMP (renal function, infection markers)',
      'Non-contrast CT not available — rely on ultrasound',
    ],
    treatment: [
      {
        autonomous: [
          'IV fluids 3L/24h (promote stone passage)',
          'Ketorolac 30 mg IV q6h (first-line analgesia)',
          'Morphine 2-4 mg IV q4h PRN breakthrough',
          'Tamsulosin 0.4 mg PO daily (MET - medical expulsive therapy)',
          'Ondansetron 4 mg IV q6h PRN nausea',
          'Strain all urine for stone capture',
        ],
        earthConsult: [
          'Review ultrasound for stone size/location',
          'If > 10 mm: unlikely to pass, consider ureteral stent',
          'If infected (fever + obstruction): emergency decompression',
          'Prevention: potassium citrate, hydration protocol for all crew',
        ],
      },
    ],
    disposition: [
      'Expect passage in 7-14 days for stones < 5 mm',
      'Stones 5-10 mm: 50% pass with MET',
      'Stones > 10 mm: usually require intervention',
      'Recurrence risk: 50% at 5 years — implement prevention for all crew',
    ],
    live: false,
    triggersAlerts: [],
    guidance: [
      'Microgravity increases stone risk: bone demineralization → hypercalciuria, dehydration, stasis.',
      'ISS incidence: ~1 per 1000 astronaut-days.',
      'Ultrasound sensitivity for stones: 60-70% (operator dependent).',
      'Capture stone for analysis — guides prevention.',
    ],
  },
  {
    id: 'arrhythmia',
    name: 'New-Onset Atrial Fibrillation with RVR',
    description: 'Crew member develops rapid Afib. Rate control vs. rhythm control decision.',
    triggerDay: null,
    duration: 14,
    severity: 'major',
    category: 'medical',
    patientId: 'okafor',
    narrative: 'MEDICAL EVENT: Okafor (Commander) reports palpitations, mild dyspnea on exertion × 2 hrs. ECG: irregularly irregular, rate 128 bpm. BP 132/82. No chest pain.',
    differential: [
      'Atrial fibrillation (new onset)',
      'Atrial flutter with variable block',
      'Multifocal atrial tachycardia',
      'Sinus tachycardia with frequent PACs',
    ],
    workup: [
      '12-lead ECG (confirm diagnosis)',
      '30-sec rhythm strip (rate, regularity)',
      'Troponin (rule out demand ischemia)',
      'BNP (volume status)',
      'Thyroid function (hyperthyroidism trigger)',
      'Electrolytes (K+, Mg2+)',
      'Echocardiogram (structural heart disease)',
    ],
    treatment: [
      {
        autonomous: [
          'Metoprolol 5 mg IV q15min × 3 target HR < 100',
          'If IV not available: metoprolol 25 mg PO q6h',
          'Diltiazem 0.25 mg/kg IV bolus then 5-15 mg/hr infusion (alternative)',
          'Anticoagulation: apixaban 5 mg BID (if CHA₂DS₂-VASc ≥ 2)',
          'Cardioversion if unstable: synchronized 50-100-200 J',
        ],
        earthConsult: [
          'Rate control vs. rhythm control strategy',
          'Anticoagulation choice (apixaban vs. warfarin — monitoring issues)',
          'If rhythm control: amiodarone loading, then cardioversion',
          'Long-term: catheter ablation on return?',
          'Commander fitness for duty — command decision impact',
        ],
      },
    ],
    disposition: [
      'Rate control acceptable for most; rhythm control if symptomatic despite rate control',
      'Anticoagulate for 4 weeks minimum post-cardioversion',
      'CHA₂DS₂-VASc score determines long-term anticoagulation',
      'Commander may need temporary command transfer if symptomatic',
    ],
    // Drives the irregular rhythm for the patient (Okafor) only.
    live: true,
    triggersAlerts: ['rhythm'],
    guidance: [
      'Afib is the most common sustained arrhythmia in spaceflight.',
      'Triggers: dehydration, stress, alcohol, thyroid, structural heart disease.',
      'In microgravity: fluid shift → atrial stretch → Afib substrate.',
      'Commander Afib = command fitness issue — flight surgeon + program manager decision.',
    ],
  },
  {
    id: 'radiation-sickness',
    name: 'Acute Radiation Syndrome (SPE)',
    description: 'Crew receives > 1 Gy during solar particle event. Prodromal syndrome management.',
    triggerDay: null,
    duration: 30,
    severity: 'critical',
    category: 'medical',
    patientId: 'reyes',
    narrative: 'RADIATION EVENT: Major SPE. Crew sheltering delayed 20 min. Reyes (Medical Officer) received estimated 1.2 Gy whole-body. Nausea/vomiting at 2 hrs post-exposure.',
    differential: [
      'Acute radiation syndrome (hematopoietic syndrome)',
      'Radiation-induced nausea/vomiting (prodromal)',
      'Combined injury (radiation + trauma/burn)',
    ],
    workup: [
      'Biodosimetry: CBC q6h × 48h (lymphocyte depletion kinetics)',
      'Chromosome aberration assay (if capability exists)',
      'Electron paramagnetic resonance (EPR) dosimetry (tooth enamel)',
      'Cytokine panel (IL-6, TNF-α, G-CSF)',
      'Serial CBC with differential (nadir at 3-4 weeks)',
    ],
    treatment: [
      {
        autonomous: [
          'Ondansetron 8 mg IV q8h (5-HT3 antagonist)',
          'Dexamethasone 4 mg IV q12h (adjunct antiemetic)',
          'Granisetron 1 mg IV q24h (if available, longer-acting)',
          'G-CSF (filgrastim) 5 mcg/kg/day SC starting Day 1 (if available)',
          'Supportive: fluids, nutrition, infection prophylaxis',
          'Potassium iodide 130 mg (if thyroid dose > 50 mSv)',
        ],
        earthConsult: [
          'Confirm dose estimate with biodosimetry',
          'G-CSF protocol and availability',
          'Antimicrobial prophylaxis (fluoroquinolone at ANC < 500)',
          'Platelet transfusion triggers (if capability exists)',
          'Stem cell transplant planning (if > 4 Gy)',
          'Psychological support for crew and patient',
        ],
      },
    ],
    disposition: [
      '1-2 Gy: Hematopoietic syndrome, recovery likely with support',
      '2-4 Gy: Significant marrow suppression, G-CSF critical',
      '> 4 Gy: LD50/60, requires aggressive support + possible transplant',
      'Long-term: cancer risk, cataract monitoring',
    ],
    live: false,
    triggersAlerts: [],
    guidance: [
      'Time to vomiting is key triage: < 1 hr = > 2 Gy, 1-2 hr = 1-2 Gy, > 2 hr = < 1 Gy.',
      'Lymphocyte count at 24h predicts severity: > 1500 = mild, 500-1500 = moderate, < 500 = severe.',
      'Medical officer being the patient creates care gap — cross-train all crew.',
      'SPE sheltering must be < 30 min from alert for < 0.5 Gy exposure.',
    ],
  },
]

// Scenario state management
export interface ActiveScenario {
  scenarioId: string
  startDay: number
  currentDay: number
  acknowledged: boolean
  patientData?: Record<string, any>
}

export function getAvailableScenarios(): Scenario[] {
  return [...SCENARIOS, ...MEDICAL_SCENARIOS]
}

export function getMedicalScenarios(): MedicalScenario[] {
  return MEDICAL_SCENARIOS
}

export function getScenarioById(id: string): Scenario | MedicalScenario | undefined {
  return [...SCENARIOS, ...MEDICAL_SCENARIOS].find((s) => s.id === id)
}

/** All scenario IDs for the store type. */
export type ScenarioId =
  | 'solar-storm'
  | 'co2-rise'
  | 'irregular-heart'
  | 'short-sleep'
  | 'missed-exercise'
  | 'appendicitis'
  | 'kidney-stone'
  | 'arrhythmia'
  | 'radiation-sickness'
  | 'behavioral-crisis'

/** Default scenario state: all null (not triggered). */
export const NO_SCENARIOS: Record<ScenarioId, number | null> = {
  'solar-storm': null,
  'co2-rise': null,
  'irregular-heart': null,
  'short-sleep': null,
  'missed-exercise': null,
  appendicitis: null,
  'kidney-stone': null,
  arrhythmia: null,
  'radiation-sickness': null,
  'behavioral-crisis': null,
}

/** Scenarios type for the store. */
export type Scenarios = Record<ScenarioId, number | null>