import { useState, useEffect, useCallback } from 'react'
import { Section, Readout } from '../components/bits'
import { dayOf, formatClock, MIN_PER_DAY } from '../sim/mission'
import { vitalsAt } from '../sim/model'
import { useCrew } from '../store/hooks'
import { useStore } from '../store/store'

interface EVAChecklistItem {
  id: string
  label: string
  critical: boolean
  checked: boolean
  category: 'suit' | 'life-support' | 'medical' | 'comm' | 'emergency'
}

interface EVAMetrics {
  metabolicRate: number
  suitCO2: number
  suitO2: number
  suitPressure: number
  coreTemp: number
  heartRate: number
  duration: number
  fatigueIndex: number
}

interface EVAEvent {
  time: number
  type: 'info' | 'caution' | 'warning'
  message: string
}

const CHECKLIST: Omit<EVAChecklistItem, 'checked'>[] = [
  { id: 'suit-pressure', label: 'Suit pressure nominal (29.6 kPa / 4.3 psi)', critical: true, category: 'suit' },
  { id: 'suit-leak', label: 'Leak check: pressure hold > 30 min', critical: true, category: 'suit' },
  { id: 'gloves', label: 'Gloves inspected, no damage', critical: false, category: 'suit' },
  { id: 'helmet', label: 'Helmet seal verified, visor clear', critical: true, category: 'suit' },
  { id: 'boots', label: 'Boots locked, tethers attached', critical: true, category: 'suit' },
  { id: 'o2-primary', label: 'Primary O2 tank > 90%', critical: true, category: 'life-support' },
  { id: 'o2-secondary', label: 'Secondary O2 tank > 90%', critical: true, category: 'life-support' },
  { id: 'scrubber', label: 'CO2 scrubber cartridge fresh', critical: true, category: 'life-support' },
  { id: 'battery', label: 'Battery > 95%, backup > 80%', critical: true, category: 'life-support' },
  { id: 'water', label: 'LCVG water supply connected', critical: false, category: 'life-support' },
  { id: 'pre-eva-vitals', label: 'Pre-EVA vitals recorded (HR, BP, SpO2, temp)', critical: true, category: 'medical' },
  { id: 'hydration', label: 'Crew hydrated: 500 mL consumed', critical: false, category: 'medical' },
  { id: 'meds', label: 'No sedating medications in 12 h', critical: false, category: 'medical' },
  { id: 'decompression', label: 'Denitrogenation protocol complete (if required)', critical: true, category: 'medical' },
  { id: 'comm-primary', label: 'Primary comm check: clear voice', critical: true, category: 'comm' },
  { id: 'comm-backup', label: 'Backup comm check', critical: false, category: 'comm' },
  { id: 'suit-telemetry', label: 'Suit telemetry streaming to IV', critical: true, category: 'comm' },
  { id: 'emergency-tether', label: 'SAFER/jetpack armed and verified', critical: true, category: 'emergency' },
  { id: 'abort-plan', label: 'Abort timeline reviewed with IV', critical: true, category: 'emergency' },
  { id: 'buddy-check', label: 'Buddy check complete', critical: true, category: 'emergency' },
]

const CATEGORY_ORDER = ['suit', 'life-support', 'medical', 'comm', 'emergency'] as const
const CATEGORY_LABELS: Record<string, string> = {
  suit: 'Suit Integrity',
  'life-support': 'Life Support',
  medical: 'Medical',
  comm: 'Communications',
  emergency: 'Emergency / Abort',
}

export function EVA() {
  const crew = useCrew()
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)

  const [evaActive, setEvaActive] = useState(false)
  const [evaStartTime, setEvaStartTime] = useState<number | null>(null)
  const [checklist, setChecklist] = useState<EVAChecklistItem[]>(() => {
    const saved = localStorage.getItem('orb-eva-checklist')
    return saved ? JSON.parse(saved) : CHECKLIST.map((c) => ({ ...c, checked: false }))
  })
  const [events, setEvents] = useState<EVAEvent[]>(() => {
    const saved = localStorage.getItem('orb-eva-events')
    return saved ? JSON.parse(saved) : []
  })
  const [notice, setNotice] = useState<string | null>(null)
  const [postForm, setPostForm] = useState({
    hr: '',
    spo2: '',
    temp: '',
    musculoskeletal: 'none',
    dcs: 'none',
    fatigue: '',
    sleep: '',
    notes: '',
  })
  const [postError, setPostError] = useState<string | null>(null)
  const [postLogged, setPostLogged] = useState<{ at: number; hr: string; spo2: string; temp: string; musculoskeletal: string; dcs: string; fatigue: string; sleep: string } | null>(null)
  const [currentMetrics, setCurrentMetrics] = useState<EVAMetrics>({
    metabolicRate: 180,
    suitCO2: 3.2,
    suitO2: 21.0,
    suitPressure: 29.6,
    coreTemp: 37.0,
    heartRate: 85,
    duration: 0,
    fatigueIndex: 0,
  })

  useEffect(() => {
    localStorage.setItem('orb-eva-checklist', JSON.stringify(checklist))
  }, [checklist])

  useEffect(() => {
    localStorage.setItem('orb-eva-events', JSON.stringify(events))
  }, [events])

  useEffect(() => {
    if (!evaActive || !evaStartTime) return

    const interval = setInterval(() => {
      setCurrentMetrics((_prev) => {
        const duration = (t - evaStartTime) / 60
        const vitals = vitalsAt(crew, t, scenarios)
        // const cabin = cabinAt(t, scenarios) // reserved for future use

        let metabolicRate = 180 + Math.sin(duration / 15) * 40 + (Math.random() - 0.5) * 20
        if (vitals.activity === 'resistance') metabolicRate += 120
        if (vitals.activity === 'cardio') metabolicRate += 80

        const co2Production = metabolicRate * 0.0012
        const suitCO2 = Math.min(7.6, 3.2 + duration * 0.08 + co2Production * 0.5 + (Math.random() - 0.5) * 0.3)

        const suitO2 = Math.max(18, 21.0 - duration * 0.015 + (Math.random() - 0.5) * 0.1)

        const suitPressure = 29.6 + (Math.random() - 0.5) * 0.1

        const coreTemp = Math.min(38.5, 37.0 + duration * 0.008 + metabolicRate * 0.0008 + (Math.random() - 0.5) * 0.1)

        const heartRate = vitals.heartRate

        const fatigueIndex = Math.min(100, duration * 0.6 + (metabolicRate - 180) * 0.15 + (suitCO2 - 3.2) * 5)

        return {
          metabolicRate: Math.round(metabolicRate),
          suitCO2: Math.round(suitCO2 * 10) / 10,
          suitO2: Math.round(suitO2 * 10) / 10,
          suitPressure: Math.round(suitPressure * 10) / 10,
          coreTemp: Math.round(coreTemp * 10) / 10,
          heartRate,
          duration: Math.round(duration),
          fatigueIndex: Math.round(fatigueIndex),
        }
      })

      if (Math.random() < 0.02) {
        const eventTypes: EVAEvent['type'][] = ['info', 'caution', 'warning']
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]
        const messages: Record<string, string[]> = {
          info: [
            'EVA timeline on track',
            'Ground confirms go for next task',
            'Suit telemetry nominal',
            'Buddy check complete',
          ],
          caution: [
            'Suit CO2 trending up ï¿½ monitor',
            'Metabolic rate elevated ï¿½ consider rest',
            'Battery at 60% ï¿½ plan return',
            'Minor glove abrasion noted',
          ],
          warning: [
            'SUIT CO2 > 7 mmHg ï¿½ RETURN TO AIRLOCK',
            'CORE TEMP > 38ï¿½C ï¿½ HEAT STRESS RISK',
            'BATTERY < 30% ï¿½ INITIATE ABORT',
            'COMM LOSS ï¿½ SWITCH TO BACKUP',
            'HEART RATE > 160 ï¿½ MANDATORY REST',
          ],
        }
        const message = messages[type][Math.floor(Math.random() * messages[type].length)]
        setEvents((prev) => [...prev, { time: t, type, message }])
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [evaActive, evaStartTime, t, crew, scenarios])

  const handleCheck = useCallback((id: string) => {
    setNotice(null)
    setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)))
  }, [])

  const startEVA = useCallback(() => {
    const uncheckedCritical = checklist.filter((c) => c.critical && !c.checked)
    if (uncheckedCritical.length > 0) {
      setNotice(`EVA blocked: ${uncheckedCritical.length} critical item${uncheckedCritical.length !== 1 ? 's' : ''} still open.`)
      return
    }
    setNotice(null)
    setEvaActive(true)
    setEvaStartTime(t)
    setEvents((prev) => [...prev, { time: t, type: 'info', message: 'EVA START ï¿½ Airlock depress complete' }])
  }, [checklist, t])

  const endEVA = useCallback(() => {
    setEvaActive(false)
    setNotice('EVA ended. Complete the post-EVA assessment below within 30 minutes.')
    setEvents((prev) => [...prev, { time: t, type: 'info', message: 'EVA END ï¿½ Airlock repress complete' }])
    setCurrentMetrics({
      metabolicRate: 180,
      suitCO2: 3.2,
      suitO2: 21.0,
      suitPressure: 29.6,
      coreTemp: 37.0,
      heartRate: 85,
      duration: 0,
      fatigueIndex: 0,
    })
  }, [t])

  const resetChecklist = useCallback(() => {
    setChecklist(CHECKLIST.map((c) => ({ ...c, checked: false })))
    setEvents([])
    setNotice(null)
    setPostLogged(null)
    setPostError(null)
  }, [])

  const logPostEva = useCallback(() => {
    if (!postForm.hr.trim() || !postForm.spo2.trim() || !postForm.temp.trim()) {
      setPostError('Heart rate, SpOâ‚‚ and core temperature are required before logging.')
      return
    }
    setPostError(null)
    setPostLogged({
      at: t,
      hr: postForm.hr,
      spo2: postForm.spo2,
      temp: postForm.temp,
      musculoskeletal: postForm.musculoskeletal,
      dcs: postForm.dcs,
      fatigue: postForm.fatigue,
      sleep: postForm.sleep,
    })
  }, [postForm, t])

  const groupedChecklist = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: checklist.filter((c) => c.category === cat),
  }))

  const allCriticalChecked = checklist.filter((c) => c.critical).every((c) => c.checked)
  const checkedCount = checklist.filter((c) => c.checked).length
  const criticalCount = checklist.filter((c) => c.critical).length
  const criticalChecked = checklist.filter((c) => c.critical && c.checked).length

  const METRIC_THRESHOLDS = {
    metabolicRate: { warn: 400, danger: 550 },
    suitCO2: { warn: 5.0, danger: 7.6 },
    suitO2: { warn: 19.5, danger: 18.0 },
    suitPressure: { warn: 28.0, danger: 25.0 },
    coreTemp: { warn: 37.8, danger: 38.5 },
    heartRate: { warn: 150, danger: 170 },
    fatigueIndex: { warn: 60, danger: 85 },
  }

  const getMetricStatus = (key: keyof typeof METRIC_THRESHOLDS, value: number) => {
    const th = METRIC_THRESHOLDS[key]
    if (value >= th.danger) return 'danger'
    if (value >= th.warn) return 'warn'
    return 'nominal'
  }

  const setPostField = (key: keyof typeof postForm, value: string) => {
    setPostForm((form) => ({ ...form, [key]: value }))
    setPostError(null)
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">EVA Monitoring</h1>
        <p className="page-intro">
          Extravehicular Activity health and suit monitoring. Pre-EVA checklist, real-time physiology, and abort criteria.
          Maps to NASA HRP Risks: <strong>Decompression Sickness</strong>, <strong>EVA Injury</strong>, <strong>Hypobaric Hypoxia</strong>.
        </p>
      </header>

      <Section title="Pre-EVA Checklist" note={`${checkedCount}/${checklist.length} complete ï¿½ ${criticalChecked}/${criticalCount} critical items`}>
        <div className="eva-controls">
          <button className={`btn ${evaActive ? 'btn-quiet' : ''}`} onClick={startEVA} disabled={evaActive || !allCriticalChecked}>
            {evaActive ? 'EVA IN PROGRESS' : 'Start EVA'}
          </button>
          <button className="btn btn-quiet" onClick={endEVA} disabled={!evaActive}>
            End EVA
          </button>
          <button className="btn btn-quiet" onClick={resetChecklist} disabled={evaActive}>
            Reset Checklist
          </button>
        </div>

        {notice && <p className="eva-notice" role="status">{notice}</p>}

        <div className="eva-progress">
          <div className="eva-progress-head">
            <span>
              <strong>{checkedCount}</strong> of {checklist.length} checks complete
            </span>
            <span>
              <strong>{criticalChecked}</strong> of {criticalCount} critical items
            </span>
          </div>
          <div
            className="eva-progress-track"
            role="progressbar"
            aria-label="Pre-EVA checklist completion"
            aria-valuemin={0}
            aria-valuemax={checklist.length}
            aria-valuenow={checkedCount}
          >
            <div className="eva-progress-fill" style={{ width: `${(checkedCount / checklist.length) * 100}%` }} />
          </div>
          {!allCriticalChecked && !evaActive && (
            <p className="muted" style={{ marginTop: 8, fontSize: 'var(--t-sm)' }}>
              Start is locked until every critical item is checked.
            </p>
          )}
        </div>

        <div className="checklist-grid">
          {groupedChecklist.map((group) => (
            <div key={group.category} className="checklist-category">
              <h4 className="checklist-category-title">{group.label}</h4>
              <div className="checklist-items">
                {group.items.map((item) => (
                  <label key={item.id} className={`checklist-item ${item.critical ? 'critical' : ''} ${item.checked ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleCheck(item.id)}
                      disabled={evaActive}
                    />
                    <span className="checklist-label">{item.label}</span>
                    {item.critical && <span className="critical-badge">CRITICAL</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {!evaActive && (
        <Section title="Live suit and physiology" note="Suit telemetry streams here once an EVA starts.">
          <div className="eva-standby">
            <strong>Suit systems idle</strong>
            <span>
              Metabolic rate, suit COâ‚‚ and Oâ‚‚, pressure, core temperature and heart rate will appear here at two-second intervals
              while the airlock is open.
            </span>
          </div>
        </Section>
      )}

      {evaActive && (
        <>
          <Section title="Live suit and physiology" note={`EVA duration: ${currentMetrics.duration} min ï¿½ Fatigue index: ${currentMetrics.fatigueIndex}/100`}>
            <div className="eva-live">Live telemetry</div>
            <div className="metrics-grid" style={{ marginTop: 12 }}>
              {[
                { key: 'metabolicRate', label: 'Metabolic Rate', value: currentMetrics.metabolicRate, unit: 'W', status: getMetricStatus('metabolicRate', currentMetrics.metabolicRate) },
                { key: 'suitCO2', label: 'Suit CO2', value: currentMetrics.suitCO2, unit: 'mmHg', status: getMetricStatus('suitCO2', currentMetrics.suitCO2) },
                { key: 'suitO2', label: 'Suit O2', value: currentMetrics.suitO2, unit: 'kPa', status: getMetricStatus('suitO2', currentMetrics.suitO2) },
                { key: 'suitPressure', label: 'Suit Pressure', value: currentMetrics.suitPressure, unit: 'kPa', status: getMetricStatus('suitPressure', currentMetrics.suitPressure) },
                { key: 'coreTemp', label: 'Core Temp', value: currentMetrics.coreTemp, unit: 'ï¿½C', status: getMetricStatus('coreTemp', currentMetrics.coreTemp) },
                { key: 'heartRate', label: 'Heart Rate', value: currentMetrics.heartRate, unit: 'bpm', status: getMetricStatus('heartRate', currentMetrics.heartRate) },
                { key: 'fatigueIndex', label: 'Fatigue Index', value: currentMetrics.fatigueIndex, unit: '/100', status: getMetricStatus('fatigueIndex', currentMetrics.fatigueIndex) },
              ].map((m) => (
                <Readout
                  key={m.key}
                  big={m.key === 'heartRate' || m.key === 'coreTemp' || m.key === 'suitCO2'}
                  label={m.label}
                  value={<span key={String(m.value)} className="metric-flash">{m.value}</span>}
                  unit={m.unit}
                  level={m.status === 'danger' ? 'urgent' : m.status === 'warn' ? 'act' : null}
                  note={m.status === 'danger' ? 'ABORT CRITERION MET' : m.status === 'warn' ? 'Monitor closely' : 'Nominal'}
                />
              ))}
            </div>

            <div className="abort-criteria">
              <h4>Abort Criteria (NASA STD-3001 Vol 2)</h4>
              <div className="abort-grid">
                {[
                  { criterion: 'Suit CO2 > 7.6 mmHg (1% CO2)', value: currentMetrics.suitCO2, threshold: 7.6, unit: 'mmHg', met: currentMetrics.suitCO2 >= 7.6 },
                  { criterion: 'Core temp > 38.5ï¿½C', value: currentMetrics.coreTemp, threshold: 38.5, unit: 'ï¿½C', met: currentMetrics.coreTemp >= 38.5 },
                  { criterion: 'Heart rate > 170 bpm sustained', value: currentMetrics.heartRate, threshold: 170, unit: 'bpm', met: currentMetrics.heartRate >= 170 },
                  { criterion: 'Suit pressure < 25 kPa', value: currentMetrics.suitPressure, threshold: 25, unit: 'kPa', met: currentMetrics.suitPressure <= 25 },
                  { criterion: 'Suit O2 < 18 kPa', value: currentMetrics.suitO2, threshold: 18, unit: 'kPa', met: currentMetrics.suitO2 <= 18 },
                  { criterion: 'Fatigue index > 85', value: currentMetrics.fatigueIndex, threshold: 85, unit: '/100', met: currentMetrics.fatigueIndex >= 85 },
                  { criterion: 'Battery < 30%', value: Math.max(0, 100 - currentMetrics.duration * 0.8), threshold: 30, unit: '%', met: (100 - currentMetrics.duration * 0.8) <= 30 },
                  { criterion: 'Mission elapsed > 8 hours', value: currentMetrics.duration, threshold: 480, unit: 'min', met: currentMetrics.duration >= 480 },
                ].map((a) => (
                  <div key={a.criterion} className={`abort-item ${a.met ? 'met' : ''}`}>
                    <span className="abort-criterion">{a.criterion}</span>
                    <div className="abort-status">
                      <span className={`abort-value ${a.met ? 'danger' : 'nominal'}`}>
                        Current: {a.value.toFixed(a.unit === '%' ? 0 : 1)} {a.unit}
                      </span>
                      <span className={`abort-badge ${a.met ? 'danger' : 'nominal'}`}>
                        {a.met ? 'ABORT' : 'GO'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section title="EVA Events Log" note={`${events.length} events ï¿½ Most recent first`}>
            <div className="events-log">
              {events.length === 0 ? (
                <p className="muted">No events yet. Events appear automatically during EVA.</p>
              ) : (
                [...events].reverse().map((e, i) => (
                  <div key={i} className={`event-entry ${e.type}`}>
                    <span className="event-time">{formatClock(e.time % MIN_PER_DAY)}</span>
                    <span className="event-type">{e.type.toUpperCase()}</span>
                    <span className="event-message">{e.message}</span>
                  </div>
                ))
              )}
            </div>
          </Section>
        </>
      )}

      <Section title="Post-EVA medical surveillance" note="Complete after every EVA. Data feeds the DCS risk model and shoulder injury surveillance.">
        <div className="post-eva-form">
          <h4>Immediate post-EVA (within 30 min)</h4>
          <div className="post-eva-grid">
            <label>
              <span>Post-EVA heart rate (bpm)</span>
              <input type="number" min={40} max={200} placeholder="e.g., 92" value={postForm.hr} onChange={(e) => setPostField('hr', e.target.value)} />
            </label>
            <label>
              <span>Post-EVA SpOâ‚‚ (%)</span>
              <input type="number" min={80} max={100} placeholder="e.g., 98" value={postForm.spo2} onChange={(e) => setPostField('spo2', e.target.value)} />
            </label>
            <label>
              <span>Post-EVA core temp (Â°C)</span>
              <input type="number" step="0.1" min={35} max={40} placeholder="e.g., 37.2" value={postForm.temp} onChange={(e) => setPostField('temp', e.target.value)} />
            </label>
            <label>
              <span>Musculoskeletal symptoms</span>
              <select value={postForm.musculoskeletal} onChange={(e) => setPostField('musculoskeletal', e.target.value)}>
                <option value="none">None</option>
                <option value="shoulder">Shoulder pain/stiffness</option>
                <option value="back">Back pain</option>
                <option value="hands">Hand fatigue/numbness</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              <span>DCS symptoms (joint pain, rash, neuro)</span>
              <select value={postForm.dcs} onChange={(e) => setPostField('dcs', e.target.value)}>
                <option value="none">None</option>
                <option value="mild">Mild joint pain (Type I)</option>
                <option value="moderate">Moderate + neuro (Type II)</option>
                <option value="severe">Severe â€” call flight surgeon</option>
              </select>
            </label>
            <label>
              <span>Fatigue rating (Borg CR10)</span>
              <input type="number" min={0} max={10} step="0.5" placeholder="0-10" value={postForm.fatigue} onChange={(e) => setPostField('fatigue', e.target.value)} />
            </label>
          </div>

          <h4 style={{ marginTop: 24 }}>24-hour follow-up</h4>
          <div className="post-eva-grid">
            <label>
              <span>Sleep quality (1-5)</span>
              <input type="number" min={1} max={5} step="0.5" placeholder="e.g., 3.5" value={postForm.sleep} onChange={(e) => setPostField('sleep', e.target.value)} />
            </label>
            <label>
              <span>Persistent symptoms</span>
              <textarea rows={2} placeholder="Any ongoing pain, numbness, rash, cognitive changes..." value={postForm.notes} onChange={(e) => setPostField('notes', e.target.value)} />
            </label>
          </div>

          {postError && <p className="eva-notice" role="alert" style={{ marginTop: 16, marginBottom: 0 }}>{postError}</p>}

          <button className="btn" type="button" style={{ marginTop: 16 }} onClick={logPostEva}>
            Log post-EVA assessment
          </button>

          {postLogged && (
            <div className="post-eva-logged" role="status">
              <strong>Assessment logged.</strong> Day {dayOf(postLogged.at)} at {formatClock(postLogged.at % MIN_PER_DAY)} ship time.
              <dl>
                <div><dt>Heart rate</dt><dd>{postLogged.hr} bpm</dd></div>
                <div><dt>SpOâ‚‚</dt><dd>{postLogged.spo2}%</dd></div>
                <div><dt>Core temp</dt><dd>{postLogged.temp} Â°C</dd></div>
                <div><dt>Musculoskeletal</dt><dd>{postLogged.musculoskeletal === 'none' ? 'None reported' : postLogged.musculoskeletal}</dd></div>
                <div><dt>DCS screen</dt><dd>{postLogged.dcs === 'none' ? 'Negative' : postLogged.dcs}</dd></div>
                {postLogged.fatigue && <div><dt>Fatigue</dt><dd>{postLogged.fatigue} / 10</dd></div>}
                {postLogged.sleep && <div><dt>Sleep quality</dt><dd>{postLogged.sleep} / 5</dd></div>}
              </dl>
            </div>
          )}
        </div>
      </Section>

      <Section title="Why this matters: NASA HRP risk mapping" note="Each EVA screen element maps to a documented Human Research Program risk.">
        <div className="risk-mapping">
          <div className="risk-card">
            <h4>Risk: Decompression Sickness (DCS)</h4>
            <p>Pre-EVA denitrogenation checklist item. Post-EVA symptom surveillance. In-suit pressure monitoring.</p>
            <span className="risk-evidence">Evidence: 26 DCS cases in US EVA history (1965-2020)</span>
          </div>
          <div className="risk-card">
            <h4>Risk: EVA Injury (Shoulder, Hand, Trauma)</h4>
            <p>Suit fit verification. Post-EVA musculoskeletal survey. Fatigue index tracks injury risk.</p>
            <span className="risk-evidence">Evidence: 47% of astronauts report shoulder injury; 31% require surgery post-flight</span>
          </div>
          <div className="risk-card">
            <h4>Risk: Hypobaric Hypoxia</h4>
            <p>Suit O2 monitoring. CO2 scrubber checklist. Real-time SpO2 would be ideal (future sensor).</p>
            <span className="risk-evidence">Evidence: Suit at 29.6 kPa = ~30% O2 at sea level equivalent</span>
          </div>
          <div className="risk-card">
            <h4>Risk: Thermal Extremes</h4>
            <p>Core temp monitoring. LCVG function checklist. Metabolic rate drives heat load.</p>
            <span className="risk-evidence">Evidence: Metabolic rates 150-500 W; LCVG removes ~60% of metabolic heat</span>
          </div>
          <div className="risk-card">
            <h4>Risk: Team Performance / Human Error</h4>
            <p>Buddy check. Abort plan review. Fatigue index. Comm checks.</p>
            <span className="risk-evidence">Evidence: Fatigue &gt; 60 correlates with 3ï¿½ procedural error rate</span>
          </div>
        </div>
      </Section>
    </>
  )
}