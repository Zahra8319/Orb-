import { useState, useEffect, useCallback, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Section } from '../components/bits'
import { commsDelaySec, dayOf, formatDelay, formatClock, MIN_PER_DAY } from '../sim/mission'
import { evaluate } from '../rules/alerts'
import { useSnapshot } from '../store/hooks'
import { useStore } from '../store/store'

interface Consultation {
  id: string
  question: string
  submittedAt: number
  /** Wall-clock submit time, used to fast-forward the transmission in the demo. */
  submittedReal: number
  delaySec: number
  status: 'pending' | 'awaiting-response' | 'responded'
  earthResponse?: string
  urgency: 'routine' | 'urgent' | 'emergency'
  category: string
}

const CATEGORIES = [
  { value: 'cardiac', label: 'Cardiac / Rhythm' },
  { value: 'respiratory', label: 'Respiratory / SpO₂' },
  { value: 'neurological', label: 'Neurological / Cognitive' },
  { value: 'musculoskeletal', label: 'Musculoskeletal / Injury' },
  { value: 'radiation', label: 'Radiation Exposure' },
  { value: 'behavioral', label: 'Behavioral / Sleep' },
  { value: 'other', label: 'Other' },
] as const

const EARTH_RESPONSES: Record<string, string[]> = {
  cardiac: [
    "Flight Surgeon: Review the 30-sec ECG strip you recorded. If Afib with RVR >110, give metoprolol 5 mg IV. Recheck in 15 min. If hemodynamically unstable, synchronized cardioversion 50 J. We'll review the strip when it downlinks.",
    "Flight Surgeon: Sinus tachycardia at 115 bpm at rest. Check hydration status — drink 500 mL water over 30 min. Review meds for stimulants. If HR persists >110 after hydration, give metoprolol 2.5 mg IV. Monitor for arrhythmia.",
    "Flight Surgeon: PVCs noted on strip. If <6/min and asymptomatic, observe. If frequent or runs of VT, give amiodarone 150 mg IV over 10 min. Obtain 12-lead when bandwidth allows.",
  ],
  respiratory: [
    "Flight Surgeon: SpO₂ 92% at rest. Increase FiO₂ to 30% via nasal cannula. Check cabin CO₂ — if >4 mmHg, that's contributing. Recheck in 20 min. If SpO₂ <90%, go to 100% non-rebreather and call us immediately.",
    "Flight Surgeon: Increased work of breathing. Rule out pneumothorax — do lung ultrasound if trained. If unilateral absent breath sounds, needle decompression 2nd ICS MCL. Otherwise, albuterol 2.5 mg neb q20 min × 3.",
  ],
  neurological: [
    "Flight Surgeon: Reaction time 18% slower. This tracks with your 5.2 h sleep avg. No acute stroke signs on your exam. Priority: protected sleep 8 h tonight. No EVA or robotics for 24 h. Re-test reaction time tomorrow AM.",
    "Flight Surgeon: New headache + photophobia. Could be CO₂, SANS, or tension. Check cabin CO₂, do fundoscopy photo for papilledema. Ibuprofen 600 mg. If worsens or neuro deficits, urgent downlink for neurology consult.",
  ],
  musculoskeletal: [
    "Flight Surgeon: Shoulder pain on ARED resistance. Likely rotator cuff tendinopathy. Modify: drop to 50% load, avoid overhead. Add scapular stabilization daily. Ice 15 min post-exercise. If no improvement in 7 days, MRI on return.",
    "Flight Surgeon: Back pain after deadlifts. Discogenic pattern? Avoid flexion under load. McKenzie extension × 10 q2h. Continue cardio. If radiculopathy, gabapentin 100 mg TID. We'll review exercise logs.",
  ],
  radiation: [
    "Flight Surgeon: Career dose at 520 mSv (87% of limit). Remaining mission: 67 days. Stay in shielded bunk for sleep. Minimize EVA. If SPE forecast, pre-position in storm shelter 30 min early. We're tracking cumulative risk.",
    "Flight Surgeon: Solar storm ongoing. Dose rate 6× normal. Remain in shelter until rate <2× background. Take potassium iodide 130 mg now if thyroid dose projected >50 mSv. We'll update when storm decays.",
  ],
  behavioral: [
    "Flight Surgeon: Sleep debt 14 h over 7 days, mood 2/5. This is a medical issue, not personal. Commander: move non-critical tasks off this crew member for 48 h. Protected 8.5 h sleep opportunity. Melatonin 3 mg at bedtime. Daily check-ins with medical officer.",
    "Flight Surgeon: Interpersonal tension reported. Standard for isolation month 5. Structured debrief tonight, 30 min, all crew. No mission business. Facilitator rotates. We have behavioral health on standby for private consult.",
  ],
  other: [
    "Flight Surgeon: Received. We'll review with the appropriate specialist and respond on next pass. In the meantime, stabilize and document.",
    "Flight Surgeon: Acknowledged. No immediate action needed. Continue current plan. We'll discuss at next scheduled medical conference.",
  ],
}

/** Stable pick from the response bank, so a consultation never changes its reply on re-render. */
function responseFor(category: string, id: string): string {
  const responses = EARTH_RESPONSES[category] ?? EARTH_RESPONSES.other
  let h = 7
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return responses[h % responses.length]
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const RING_CIRCUMFERENCE = 163.36
const REPLY_LAG_SEC = 30
/** The exchange plays 60× faster than real light-time so the demo fits a minute. */
const COMPRESSION = 60

export function Consult() {
  const t = useStore((s) => s.t)
  const snap = useSnapshot()
  const alerts = evaluate(snap)
  const formRef = useRef<HTMLElement | null>(null)

  const [consultations, setConsultations] = useState<Consultation[]>(() => {
    const saved = localStorage.getItem('orb-consultations-v2')
    return saved ? JSON.parse(saved) : []
  })
  const [question, setQuestion] = useState('')
  const [category, setCategory] = useState('cardiac')
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine')
  const [flash, setFlash] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // Drive the transmission with wall-clock time so it plays at the same pace
  // regardless of the mission clock speed setting.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  // Persist consultations
  useEffect(() => {
    localStorage.setItem('orb-consultations-v2', JSON.stringify(consultations))
  }, [consultations])

  // Advance each transmission. Light-time seconds are compressed 60×.
  useEffect(() => {
    setConsultations((prev) => {
      let changed = false
      const next = prev.map((c) => {
        if (c.status === 'responded') return c
        const elapsedLightSec = ((now - c.submittedReal) / 1000) * COMPRESSION
        if (elapsedLightSec >= c.delaySec + REPLY_LAG_SEC) {
          changed = true
          return { ...c, status: 'responded' as const, earthResponse: c.earthResponse ?? responseFor(c.category, c.id) }
        }
        if (elapsedLightSec >= c.delaySec && c.status === 'pending') {
          changed = true
          return { ...c, status: 'awaiting-response' as const }
        }
        return c
      })
      return changed ? next : prev
    })
  }, [now])

  const handleSubmit = useCallback(() => {
    if (!question.trim()) return
    const delaySec = commsDelaySec(t) * 2 // round trip
    const newConsultation: Consultation = {
      id: generateId(),
      question: question.trim(),
      submittedAt: t,
      submittedReal: Date.now(),
      delaySec,
      status: 'pending',
      urgency,
      category,
    }
    setConsultations((prev) => [newConsultation, ...prev])
    setFlash(
      `Transmitted. Earth receives it in ${formatDelay(delaySec / 2)}. Reply due about ${formatClock(
        (t + delaySec / 60 + REPLY_LAG_SEC / 60) % MIN_PER_DAY,
      )} ship time — fast-forwarded to about ${Math.round((delaySec + REPLY_LAG_SEC) / COMPRESSION)} seconds in this simulation.`,
    )
    setQuestion('')
  }, [t, question, urgency, category])

  const secondsRemaining = (c: Consultation): number => {
    const elapsedLightSec = ((now - c.submittedReal) / 1000) * COMPRESSION
    if (c.status === 'pending') return Math.max(0, c.delaySec - elapsedLightSec)
    if (c.status === 'awaiting-response') return Math.max(0, c.delaySec + REPLY_LAG_SEC - elapsedLightSec)
    return 0
  }

  const progress = (c: Consultation): number => {
    const elapsedLightSec = ((now - c.submittedReal) / 1000) * COMPRESSION
    if (c.status === 'pending') return Math.min(100, Math.max(0, (elapsedLightSec / c.delaySec) * 100))
    if (c.status === 'awaiting-response') {
      return Math.min(100, Math.max(0, ((elapsedLightSec - c.delaySec) / REPLY_LAG_SEC) * 100))
    }
    return 100
  }

  const formatTimeRemaining = (sec: number): string => {
    if (sec <= 0) return 'Arriving'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
  }

  const pendingCount = consultations.filter((c) => c.status !== 'responded').length
  const roundTrip = commsDelaySec(t) * 2

  const prefillFromAlert = (alert: (typeof alerts)[number]) => {
    setCategory(
      alert.id.includes('heart') || alert.id === 'rhythm'
        ? 'cardiac'
        : alert.id === 'spo2' || alert.id === 'o2' || alert.id === 'co2'
          ? 'respiratory'
          : alert.id === 'sleep' || alert.id === 'reaction'
            ? 'behavioral'
            : alert.id === 'exercise'
              ? 'musculoskeletal'
              : alert.id === 'solar-storm' || alert.id === 'career-dose'
                ? 'radiation'
                : 'other',
    )
    setUrgency(alert.level === 'urgent' ? 'emergency' : alert.level === 'act' ? 'urgent' : 'routine')
    setQuestion(
      `Alert: ${alert.title}. ${alert.action} Should I proceed autonomously or wait for Earth guidance? Current vitals: HR ${snap.vitals.heartRate}, SpO₂ ${snap.vitals.spo2}%, Cabin CO₂ ${snap.cabin.co2} mmHg.`,
    )
    setFlash(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Consult Earth</h1>
        <p className="page-intro">
          One-way delay: <strong>{formatDelay(commsDelaySec(t))}</strong>. Round trip: <strong>{formatDelay(roundTrip)}</strong>.
          Submit a medical question — Earth responds after the light-time delay. While you wait, you decide autonomously.
        </p>
      </header>

      <section className="section" ref={formRef}>
        <h2 className="section-title">New consultation</h2>
        <p className="section-note">Describe the clinical question. Earth responds after the round-trip delay.</p>
        <div className="section-body">
          <div className="consult-form">
            <div className="form-row">
              <label>
                <span>Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Urgency</span>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value as typeof urgency)}>
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </label>
            </div>
            <label className="textarea-label">
              <span>Clinical question / situation</span>
              <textarea
                value={question}
                onChange={(e) => { setQuestion(e.target.value); setFlash(null) }}
                placeholder="e.g., 'Crew member Reyes: new-onset irregularly irregular rhythm at 118 bpm, asymptomatic. 30-sec ECG recorded. Give metoprolol 5 mg IV now, or wait for Earth guidance?'"
                rows={4}
              />
            </label>
            <div className="consult-submit">
              <button className="btn" onClick={handleSubmit} disabled={!question.trim()}>
                Transmit to Mission Control
              </button>
              <span className="consult-submit-note">
                Round trip {formatDelay(roundTrip)} · fast-forwarded to about{' '}
                {Math.round((roundTrip + REPLY_LAG_SEC) / COMPRESSION)} seconds
              </span>
            </div>
            {flash && (
              <p className="form-flash" role="status">
                {flash}
              </p>
            )}
          </div>
        </div>
      </section>

      <Section
        title={`Active consultations${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
        note="Your transmission travels at light speed. The countdown shows real light-time, fast-forwarded 60× so you can watch the exchange complete."
      >
        {consultations.length === 0 ? (
          <p className="muted">No consultations yet. Submit one above to see the delay in action.</p>
        ) : (
          <div className="consult-list">
            {consultations.map((c) => {
              const remaining = secondsRemaining(c)
              const pct = progress(c)
              const railStyle = { '--p': pct / 100 } as CSSProperties
              const returning = c.status === 'awaiting-response' || c.status === 'responded'

              return (
                <article key={c.id} className={`consult-card ${c.status} ${c.urgency}`}>
                  <div className="consult-header">
                    <div className="consult-meta">
                      <span className={`urgency-badge ${c.urgency}`}>{c.urgency.toUpperCase()}</span>
                      <span className="category-badge">{CATEGORIES.find((cat) => cat.value === c.category)?.label}</span>
                      <span className="time-badge">
                        Sent Day {dayOf(c.submittedAt)} at {formatClock(c.submittedAt % MIN_PER_DAY)}
                      </span>
                    </div>
                    <div className="consult-status">
                      {c.status === 'responded' ? (
                        <span className="status-label responded">Response received</span>
                      ) : (
                        <>
                          <div
                            className={`progress-ring ${c.status === 'awaiting-response' ? 'waiting' : ''}`}
                            role="progressbar"
                            aria-label={c.status === 'pending' ? 'Signal travelling to Earth' : 'Reply travelling to the ship'}
                            aria-valuenow={Math.round(pct)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <svg className="ring-svg" viewBox="0 0 64 64" aria-hidden="true">
                              <circle className="ring-ring" cx="32" cy="32" r="26" />
                              <circle
                                className="ring-mark"
                                cx="32"
                                cy="32"
                                r="26"
                                strokeDashoffset={RING_CIRCUMFERENCE * (1 - pct / 100)}
                              />
                            </svg>
                            <span className="progress-text">{formatTimeRemaining(remaining)}</span>
                          </div>
                          <span className="status-label">
                            {c.status === 'pending' ? 'In transit to Earth' : 'Earth replying — inbound'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className={`transit-rail ${returning ? 'returning' : ''} ${pct >= 100 ? 'arrived' : ''}`}
                    style={railStyle}
                    aria-hidden="true"
                  >
                    <span className="transit-end">Ship</span>
                    <span className="transit-track">
                      <span className={`transit-dot ${returning && pct >= 100 ? 'arrived' : ''}`} />
                    </span>
                    <span className="transit-end">Earth</span>
                  </div>

                  <div className="consult-question">
                    <strong>Question:</strong> {c.question}
                  </div>

                  {c.status === 'responded' && c.earthResponse && (
                    <div className="consult-response">
                      <div className="response-header">
                        <span className="earth-badge">Earth response</span>
                        <span className="response-time">
                          Received Day {dayOf(t)} at {formatClock(t % MIN_PER_DAY)}
                        </span>
                      </div>
                      <div className="response-text">{c.earthResponse}</div>
                      <div className="response-reflection">
                        <strong>Autonomous decision point:</strong> You received this guidance after a {formatDelay(c.delaySec)} round trip.
                        In a real emergency, you would have had to act before this arrived. What did you do in the meantime?
                      </div>
                    </div>
                  )}

                  {c.status !== 'responded' && (
                    <div className="autonomous-prompt">
                      <strong>While you wait ({formatTimeRemaining(remaining)} remaining):</strong> what is your autonomous plan
                      right now? Document your reasoning for the debrief.
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Alerts requiring a decision" note="These active alerts may need consultation. Choose one to pre-fill the form.">
        {alerts.length === 0 ? (
          <p className="muted">No active alerts. All systems nominal.</p>
        ) : (
          <div className="alert-quick-consult">
            {alerts.map((a) => (
              <button key={a.id} className={`alert-quick-btn ${a.level}`} onClick={() => prefillFromAlert(a)}>
                <span className="alert-quick-title">{a.title}</span>
                <span className="alert-quick-action">{a.action}</span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="Why this matters for Mars" note="Communication delay fundamentally changes medical operations.">
        <div className="mars-context">
          <div className="mars-card">
            <h4>Earth orbit (ISS)</h4>
            <p>Delay: <strong>about 0 seconds</strong>. Flight surgeons monitor in real time. Crew executes, Earth decides.</p>
          </div>
          <div className="mars-card">
            <h4>Moon (Artemis)</h4>
            <p>Delay: <strong>about 1.3 seconds</strong> each way. Near-real-time. Earth stays in the loop for major decisions.</p>
          </div>
          <div className="mars-card current">
            <h4>Mars transit (this mission)</h4>
            <p>Delay: <strong>{formatDelay(commsDelaySec(t))}</strong> one way. <strong>{formatDelay(roundTrip)}</strong> round trip.</p>
            <p className="mars-emphasis">Crew must decide autonomously. Earth advises, does not direct.</p>
          </div>
        </div>
        <div className="mars-lessons">
          <h4>What this simulator teaches</h4>
          <ol className="mars-lessons-list">
            <li><strong>Document your reasoning</strong> — the flight surgeon needs to understand your autonomous decision when they finally respond.</li>
            <li><strong>Stabilize first</strong> — in an emergency, you act before Earth knows there is a problem.</li>
            <li><strong>Consult early for non-emergencies</strong> — use the delay productively; submit routine questions before they become urgent.</li>
            <li><strong>Trust your training</strong> — you are the medical provider on scene. Earth is a consultant, not the commander.</li>
          </ol>
        </div>
      </Section>
    </>
  )
}
