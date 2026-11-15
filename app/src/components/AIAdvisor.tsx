import { useState, useEffect } from 'react'
import { X, Stethoscope, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useStore } from '../store/store'
import { evaluate } from '../rules/alerts'
import { snapshot } from '../sim/model'
import { CREW } from '../sim/crew'

/** What the advisor knows how to address. */
interface Protocol {
  id: string
  title: string
  triggers: string[]
  /** Immediate autonomous steps (crew can do now, before Earth replies). */
  autonomous: string[]
  /** What to ask Earth when the consult returns. */
  earthQuestions: string[]
  /** Red-flag criteria: if any match, escalate to URGENT. */
  redFlags: string[]
}

const PROTOCOLS: Protocol[] = [
  {
    id: 'irregular-rhythm',
    title: 'Irregular rhythm / new Afib',
    triggers: ['irregular', 'afib', 'atrial fibrillation', 'rhythm'],
    autonomous: [
      'Record a 30-second ECG strip now.',
      'If HR > 110 bpm at rest: give metoprolol 5 mg IV (or 25 mg PO if IV unavailable). Recheck in 15 min.',
      'If hemodynamically unstable (SBP < 90, altered mental status): synchronized cardioversion 50 J.',
      'Sit the crew member down, continuous SpO₂ monitoring.',
    ],
    earthQuestions: [
      'Strip shows irregularly irregular at 118 bpm. Rate control with metoprolol started. Confirm or escalate?',
      'Any contraindication to amiodarone if rate control fails?',
    ],
    redFlags: ['HR > 130', 'SBP < 90', 'chest pain', 'syncope'],
  },
  {
    id: 'tachycardia',
    title: 'Sinus tachycardia (HR > 110 at rest)',
    triggers: ['tachycardia', 'heart rate', 'hr > 110', 'elevated heart rate'],
    autonomous: [
      'Hydrate: 500 mL water over 30 min.',
      'Review meds for stimulants (caffeine, decongestants).',
      'If HR persists > 110 after hydration: metoprolol 2.5 mg IV.',
      'Monitor for arrhythmia — record ECG if rhythm becomes irregular.',
    ],
    earthQuestions: [
      'HR 115 at rest, hydrated. Persists after 500 mL. Start metoprolol 2.5 mg IV?',
    ],
    redFlags: ['HR > 130', 'chest pain', 'dyspnea at rest'],
  },
  {
    id: 'hypoxia',
    title: 'Low SpO₂ / respiratory distress',
    triggers: ['spo2', 'oxygen', 'hypoxia', 'shortness of breath', 'dyspnea', 'respiratory'],
    autonomous: [
      'If SpO₂ < 90%: 100% non-rebreather mask immediately.',
      'If SpO₂ 90–94%: nasal cannula 4 L/min, target > 95%.',
      'Check cabin CO₂ — if > 4 mmHg, that\'s contributing. Increase scrubber.',
      'Lung ultrasound if trained: rule out pneumothorax.',
      'If unilateral absent breath sounds: needle decompression 2nd ICS MCL.',
    ],
    earthQuestions: [
      'SpO₂ 92% on 4 L/min NC. Cabin CO₂ 3.8 mmHg. Continue or escalate FiO₂?',
    ],
    redFlags: ['SpO₂ < 88%', 'tracheal deviation', 'absent breath sounds unilateral'],
  },
  {
    id: 'sleep-debt',
    title: 'Sleep debt / cognitive degradation',
    triggers: ['sleep', 'fatigue', 'reaction time', 'cognitive', 'mood'],
    autonomous: [
      'Protected sleep opportunity: 8.5 h tonight, no mission-critical tasks.',
      'Reassign piloting/robotics/EVA for next 24 h.',
      'Melatonin 3 mg at bedtime (if not contraindicated).',
      'Daily check-ins with medical officer.',
    ],
    earthQuestions: [
      'Sleep debt 14 h / 7 days, mood 2/5, reaction +22%. Crew reassigned from critical tasks. Confirm plan?',
    ],
    redFlags: ['reaction > 25% slower', 'mood 1/5', 'microsleeps reported'],
  },
  {
    id: 'musculoskeletal',
    title: 'Musculoskeletal injury (shoulder, back, hand)',
    triggers: ['shoulder', 'back pain', 'musculoskeletal', 'injury', 'pain', 'ared'],
    autonomous: [
      'Modify exercise: drop to 50% load, avoid overhead/axial loading.',
      'Ice 15 min post-exercise. NSAID (ibuprofen 600 mg q6h) if no contraindication.',
      'Add scapular stabilization / McKenzie extensions daily.',
      'If no improvement in 7 days: ultrasound on next pass, MRI on return.',
    ],
    earthQuestions: [
      'Shoulder pain on ARED resistance. Modified to 50% load. MRI on return or earlier?',
    ],
    redFlags: ['radiculopathy', 'weakness', 'numbness', 'pain at rest'],
  },
  {
    id: 'radiation',
    title: 'Radiation exposure / SPE',
    triggers: ['radiation', 'dose', 'solar storm', 'spe', 'particle'],
    autonomous: [
      'If SPE forecast: pre-position in storm shelter 30 min early.',
      'Stay in shielded bunk for sleep. Minimize EVA.',
      'If thyroid dose projected > 50 mSv: potassium iodide 130 mg now.',
      'Track cumulative career dose against 600 mSv limit.',
    ],
    earthQuestions: [
      'Career dose 520 mSv (87% limit). 67 days remaining. Confirm shelter protocol?',
    ],
    redFlags: ['dose rate > 10× normal', 'career dose > 550 mSv', 'nausea/vomiting'],
  },
  {
    id: 'co2',
    title: 'Elevated cabin CO₂',
    triggers: ['co2', 'carbon dioxide', 'scrubber', 'headache'],
    autonomous: [
      'Run backup scrubber. Report CO₂ every 30 min.',
      'Target < 3 mmHg. Headaches should ease under 3 mmHg.',
      'Increase cabin ventilation if available.',
    ],
    earthQuestions: [
      'Cabin CO₂ 4.2 mmHg. Backup scrubber running. Target < 3 mmHg in 2 h. Confirm?',
    ],
    redFlags: ['CO₂ > 7 mmHg', 'neuro symptoms', 'unconsciousness'],
  },
]

/** Match protocols against current alerts + free text. */
function matchProtocols(alerts: ReturnType<typeof evaluate>, query: string): Protocol[] {
  const text = query.toLowerCase()
  const alertIds = alerts.map((a) => a.id)
  const alertTitles = alerts.map((a) => a.title.toLowerCase())

  return PROTOCOLS.filter((p) => {
    const hitsTriggers = p.triggers.some((t) => text.includes(t) || alertTitles.some((at) => at.includes(t)))
    const hitsAlerts = alertIds.some((id) => p.triggers.includes(id))
    return hitsTriggers || hitsAlerts
  })
}

/** Quick triage: return the most urgent protocol, or null. */
function triage(alerts: ReturnType<typeof evaluate>): Protocol | null {
  const urgent = alerts.some((a) => a.level === 'urgent')
  if (!urgent) return null
  const matched = matchProtocols(alerts, '')
  return matched[0] || null
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  protocol?: Protocol
}

export function AIAdvisor() {
  const crewId = useStore((s) => s.crewId)
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const snap = snapshot(CREW.find((c) => c.id === crewId)!, t, scenarios)
  const alerts = evaluate(snap)

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)

  // Auto-open if there's an urgent alert and no messages yet
  useEffect(() => {
    const urgentProtocol = triage(alerts)
    if (urgentProtocol && messages.length === 0 && !open) {
      setOpen(true)
      setMessages([
        {
          role: 'system',
          content: `⚠️ Urgent: ${urgentProtocol.title} detected. Here are your immediate autonomous steps:`,
          protocol: urgentProtocol,
        },
      ])
    }
  }, [alerts, open, messages.length])

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setThinking(true)

    // Simulate "thinking" then respond with matched protocols
    setTimeout(() => {
      const matched = matchProtocols(alerts, userMsg)
      if (matched.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'I don\'t have a specific protocol for that. Describe the symptoms or paste the alert title, and I\'ll match the closest NASA guidance.',
          },
        ])
      } else {
        matched.forEach((p, i) => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                (i === 0 ? `**${p.title}** — here's what to do now:\n\n` : '') +
                p.autonomous.map((s, j) => `${j + 1}. ${s}`).join('\n') +
                (p.earthQuestions.length
                  ? `\n\n**When Earth replies, ask:**\n${p.earthQuestions.map((q) => `• ${q}`).join('\n')}`
                  : '') +
                (p.redFlags.length
                  ? `\n\n🔴 **Escalate immediately if:** ${p.redFlags.join(', ')}`
                  : ''),
            protocol: p,
            },
          ])
        })
      }
      setThinking(false)
    }, 600 + Math.random() * 400)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        className="ai-trigger"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close medical advisor' : 'Open medical advisor'}
        aria-expanded={open}
      >
        <Stethoscope size={20} aria-hidden="true" />
        <span className="ai-trigger-text">Orb Medical</span>
        {triage(alerts) && <span className="ai-pulse" aria-hidden="true" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="ai-panel" role="dialog" aria-label="Orb Medical Advisor">
          <div className="ai-header">
            <div className="ai-title-row">
              <Stethoscope size={18} aria-hidden="true" />
              <span>Orb Medical Advisor</span>
              {triage(alerts) && (
                <AlertTriangle className="ai-urgent-badge" size={16} aria-label="Urgent protocol active" />
              )}
            </div>
            <button className="ai-close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="ai-messages">
            {messages.length === 0 && (
              <div className="ai-welcome">
                <p>Describe the situation or paste an alert title. I'll match NASA medical protocols and give you immediate autonomous steps.</p>
                <div className="ai-chips">
                  {['Irregular rhythm at 118', 'SpO₂ dropped to 91%', 'Sleep debt 14 hrs', 'Shoulder pain on ARED', 'Cabin CO₂ 4.5 mmHg'].map((q) => (
                    <button key={q} className="ai-chip" onClick={() => { setInput(q); handleSend(); }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.role}`}>
                {msg.role === 'system' && <span className="ai-system-badge">URGENT</span>}
                <div className="ai-bubble">{msg.content}</div>
                {msg.protocol && (
                  <div className="ai-protocol-ref">
                    <CheckCircle size={14} aria-hidden="true" />
                    <span>Protocol: {msg.protocol.title}</span>
                  </div>
                )}
              </div>
            ))}
            {thinking && (
              <div className="ai-message assistant">
                <Loader2 className="ai-thinking" size={16} aria-hidden="true" />
                <span>Matching protocols…</span>
              </div>
            )}
          </div>

          <div className="ai-input-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Describe symptoms, paste alert, or ask a question…"
              aria-label="Medical question"
              disabled={thinking}
            />
            <Button onClick={handleSend} disabled={!input.trim() || thinking} size="icon">
              <Loader2 size={16} className={thinking ? 'spin' : ''} aria-hidden={!thinking} />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

/** Tiny hook to use the advisor anywhere. */
export function useAIAdvisor() {
  const crewId = useStore((s) => s.crewId)
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const snap = snapshot(CREW.find((c) => c.id === crewId)!, t, scenarios)
  const alerts = evaluate(snap)
  return { alerts, triage: triage(alerts) }
}