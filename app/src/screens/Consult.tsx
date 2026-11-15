import { useState, useEffect, useCallback } from 'react'
import { Section } from '../components/bits'
import { commsDelaySec, formatDelay, formatClock, MIN_PER_DAY } from '../sim/mission'
import { evaluate } from '../rules/alerts'
import { useSnapshot } from '../store/hooks'
import { useStore } from '../store/store'

interface Consultation {
  id: string
  question: string
  submittedAt: number
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

function getRandomResponse(category: string): string {
  const responses = EARTH_RESPONSES[category] || EARTH_RESPONSES.other
  return responses[Math.floor(Math.random() * responses.length)]
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function Consult() {
  const t = useStore((s) => s.t)
  const snap = useSnapshot()
  const alerts = evaluate(snap)

  const [consultations, setConsultations] = useState<Consultation[]>(() => {
    const saved = localStorage.getItem('orb-consultations')
    return saved ? JSON.parse(saved) : []
  })
  const [question, setQuestion] = useState('')
  const [category, setCategory] = useState('cardiac')
  const [urgency, setUrgency] = useState<'routine' | 'urgent' | 'emergency'>('routine')

  // Persist consultations
  useEffect(() => {
    localStorage.setItem('orb-consultations', JSON.stringify(consultations))
  }, [consultations])

  // Update consultation timers
  useEffect(() => {
    const interval = setInterval(() => {
      setConsultations((prev) =>
        prev.map((c) => {
          if (c.status === 'pending') {
            const elapsed = (t - c.submittedAt) / 60 // t is in minutes, convert to seconds
            if (elapsed >= c.delaySec) {
              return { ...c, status: 'awaiting-response' }
            }
          }
          if (c.status === 'awaiting-response') {
            // Simulate Earth processing time (30-120 sec after delay)
            const elapsed = (t - c.submittedAt) / 60
            if (elapsed >= c.delaySec + 60) {
              return { ...c, status: 'responded', earthResponse: getRandomResponse(c.category) }
            }
          }
          return c
        })
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [t])

  const handleSubmit = useCallback(() => {
    if (!question.trim()) return
    const delaySec = commsDelaySec(t) * 2 // round trip
    const newConsultation: Consultation = {
      id: generateId(),
      question: question.trim(),
      submittedAt: t,
      delaySec,
      status: 'pending',
      urgency,
      category,
    }
    setConsultations((prev) => [newConsultation, ...prev])
    setQuestion('')
  }, [t, question, urgency, category])

  const getTimeRemaining = (c: Consultation): number => {
    const elapsed = (t - c.submittedAt) / 60
    if (c.status === 'pending') return Math.max(0, c.delaySec - elapsed)
    if (c.status === 'awaiting-response') return Math.max(0, c.delaySec + 60 - elapsed)
    return 0
  }

  const formatTimeRemaining = (sec: number): string => {
    if (sec <= 0) return 'Arriving...'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
  }

  const pendingCount = consultations.filter((c) => c.status !== 'responded').length

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Consult Earth</h1>
        <p className="page-intro">
          One-way delay: <strong>{formatDelay(commsDelaySec(t))}</strong>. Round trip: <strong>{formatDelay(commsDelaySec(t) * 2)}</strong>.
          Submit a medical question — Earth responds after the light-time delay. While you wait, you decide autonomously.
        </p>
      </header>

      <Section title="New Consultation" note="Describe the clinical question. Earth responds after the round-trip delay.">
        <div className="consult-form">
          <div className="form-row">
            <label>
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
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
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., 'Crew member Reyes: new-onset irregularly irregular rhythm at 118 bpm, asymptomatic. 30-sec ECG recorded. Give metoprolol 5 mg IV now, or wait for Earth guidance?'"
              rows={4}
            />
          </label>
          <button className="btn" onClick={handleSubmit} disabled={!question.trim()}>
            Transmit to Mission Control ({formatDelay(commsDelaySec(t) * 2)} round trip)
          </button>
        </div>
      </Section>

      <Section
        title={`Active Consultations ${pendingCount > 0 ? `(${pendingCount})` : ''}`}
        note="Your transmission travels at light speed. Earth receives it after the one-way delay, formulates a response, and transmits back."
      >
        {consultations.length === 0 ? (
          <p className="muted">No consultations yet. Submit one above to see the delay in action.</p>
        ) : (
          <div className="consult-list">
            {consultations.map((c) => {
              const timeRemaining = getTimeRemaining(c)
              const progress = c.status === 'pending'
                ? ((c.delaySec - timeRemaining) / c.delaySec) * 100
                : c.status === 'awaiting-response'
                ? 100
                : 100

              return (
                <article key={c.id} className={`consult-card ${c.status} ${c.urgency}`}>
                  <div className="consult-header">
                    <div className="consult-meta">
                      <span className={`urgency-badge ${c.urgency}`}>{c.urgency.toUpperCase()}</span>
                      <span className="category-badge">{CATEGORIES.find((cat) => cat.value === c.category)?.label}</span>
                      <span className="time-badge">
                        Submitted: Day {Math.floor(c.submittedAt / MIN_PER_DAY) + 1} at {formatClock(c.submittedAt % MIN_PER_DAY)}
                      </span>
                    </div>
                    <div className="consult-status">
                      {c.status === 'pending' && (
                        <>
                          <div className="progress-ring" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} style={{ background: `conic-gradient(var(--series-1) ${progress}%, var(--planned) 0)` }}>
                            <span className="progress-text">{formatTimeRemaining(timeRemaining)}</span>
                          </div>
                          <span className="status-label">In transit to Earth</span>
                        </>
                      )}
                      {c.status === 'awaiting-response' && (
                        <>
                          <div className="progress-ring waiting" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
                            <span className="progress-text">{formatTimeRemaining(timeRemaining)}</span>
                          </div>
                          <span className="status-label">Earth received — formulating response</span>
                        </>
                      )}
                      {c.status === 'responded' && (
                        <span className="status-label responded">Response received</span>
                      )}
                    </div>
                  </div>

                  <div className="consult-question">
                    <strong>Question:</strong> {c.question}
                  </div>

                  {c.status === 'responded' && c.earthResponse && (
                    <div className="consult-response">
                      <div className="response-header">
                        <span className="earth-badge">🌍 Earth Response</span>
                        <span className="response-time">Received Day {Math.floor(t / MIN_PER_DAY) + 1} at {formatClock(t % MIN_PER_DAY)}</span>
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
                      <strong>⏱ While you wait ({formatTimeRemaining(timeRemaining)} remaining):</strong>
                      What is your autonomous plan right now? Document your reasoning for the debrief.
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Current Alerts Requiring Decisions" note="These active alerts may need consultation. Click to pre-fill the form.">
        {alerts.length === 0 ? (
          <p className="muted">No active alerts. All systems nominal.</p>
        ) : (
          <div className="alert-quick-consult">
            {alerts.map((a) => (
              <button
                key={a.id}
                className={`alert-quick-btn ${a.level}`}
                onClick={() => {
                  setCategory(
                    a.id.includes('heart') || a.id === 'rhythm'
                      ? 'cardiac'
                      : a.id === 'spo2' || a.id === 'o2' || a.id === 'co2'
                      ? 'respiratory'
                      : a.id === 'sleep' || a.id === 'reaction'
                      ? 'behavioral'
                      : a.id === 'exercise'
                      ? 'musculoskeletal'
                      : a.id === 'solar-storm' || a.id === 'career-dose'
                      ? 'radiation'
                      : 'other'
                  )
                  setUrgency(a.level === 'urgent' ? 'emergency' : a.level === 'act' ? 'urgent' : 'routine')
                  setQuestion(
                    `Alert: ${a.title}. ${a.action} Should I proceed autonomously or wait for Earth guidance? Current vitals: HR ${snap.vitals.heartRate}, SpO₂ ${snap.vitals.spo2}%, Cabin CO₂ ${snap.cabin.co2} mmHg.`
                  )
                }}
              >
                <span className="alert-quick-title">{a.title}</span>
                <span className="alert-quick-action">{a.action}</span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="Why This Matters for Mars" note="Communication delay fundamentally changes medical operations.">
        <div className="mars-context">
          <div className="mars-card">
            <h4>Earth-Orbit (ISS)</h4>
            <p>Delay: <strong>~0 seconds</strong>. Flight surgeons monitor in real time. Crew executes, Earth decides.</p>
          </div>
          <div className="mars-card">
            <h4>Moon (Artemis)</h4>
            <p>Delay: <strong>~1.3 seconds</strong> each way. Near-real-time. Earth still in the loop for major decisions.</p>
          </div>
          <div className="mars-card">
            <h4>Mars Transit (This Mission)</h4>
            <p>Delay: <strong>{formatDelay(commsDelaySec(t))}</strong> one way. <strong>{formatDelay(commsDelaySec(t) * 2)}</strong> round trip.</p>
            <p className="mars-emphasis">Crew MUST decide autonomously. Earth advises, does not direct.</p>
          </div>
        </div>
        <div className="mars-lessons">
          <h4>What This Simulator Teaches</h4>
          <ul>
            <li><strong>Document your reasoning</strong> — the flight surgeon needs to understand your autonomous decision when they finally respond</li>
            <li><strong>Stabilize first</strong> — in an emergency, you act before Earth knows there's a problem</li>
            <li><strong>Consult early for non-emergencies</strong> — use the delay productively; submit routine questions before they become urgent</li>
            <li><strong>Trust your training</strong> — you are the medical provider on scene. Earth is a consultant, not the commander.</li>
          </ul>
        </div>
      </Section>
    </>
  )
}