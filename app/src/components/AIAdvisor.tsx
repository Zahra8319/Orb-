import { useState, useEffect, useCallback } from 'react'
import { X, Stethoscope, AlertTriangle, CheckCircle, Loader2, WifiOff, Zap, Send } from 'lucide-react'
import { Button } from '../components/ui/button'
import { useAlerts } from '../store/hooks'
import type { Alert } from '../rules/alerts'

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
      'Monitor for arrhythmia; record ECG if rhythm becomes irregular.',
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
      'Check cabin CO2; if > 4 mmHg, that\'s contributing. Increase scrubber.',
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
      'Stay in the shelter until the dose rate falls below 5 times normal, then log your dose.',
      'Track cumulative career dose against 600 mSv limit.',
    ],
    earthQuestions: [
      'Confirm the shelter plan and my remaining career dose budget against the 600 mSv limit?',
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
function matchProtocols(alerts: Alert[], query: string): Protocol[] {
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
function triage(alerts: Alert[]): Protocol | null {
  const urgent = alerts.some((a) => a.level === 'urgent')
  if (!urgent) return null
  const matched = matchProtocols(alerts, '')
  return matched[0] || null
}

const NASA_SYSTEM_PROMPT = `You are a NASA flight surgeon assisting a crew member on a deep-space mission.
Communication delay to Earth is significant. The crew must act autonomously.
Only reference NASA standards: STD-3001 Vol 2, HRP Evidence Books, JSC Medical Checklists, NASA-STD-3000.
If a question is outside these documents, say: "Consult flight surgeon on next pass."
Be concise. Lead with immediate autonomous actions. No markdown unless asked.`

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  protocol?: Protocol
  source?: 'protocol' | 'groq' | 'offline'
}

async function askGroq(question: string, alerts: Alert[]): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) throw new Error('No Groq API key')

  const context = alerts.length
    ? `Current alerts: ${alerts.map((a) => `${a.title} (${a.level})`).join('; ')}.`
    : 'No active alerts.'

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // llama-3.1-70b-versatile was retired by Groq; this is its replacement.
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: 'system', content: NASA_SYSTEM_PROMPT },
        { role: 'user', content: `${context}\n\nQuestion: ${question}` },
      ],
    }),
  })

  if (!res.ok) throw new Error(`Groq error: ${res.status}`)
  const data = await res.json()
  return data.choices[0]?.message?.content ?? 'No response from Groq.'
}

export function AIAdvisor() {
  // The same alerts as the banner, including the crew member's own entries.
  const alerts = useAlerts()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [groqAvailable, setGroqAvailable] = useState(() => !!import.meta.env.VITE_GROQ_API_KEY)

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
          source: 'protocol',
        },
      ])
    }
  }, [alerts, open, messages.length])

  const handleSend = useCallback((text: string) => {
    if (!text.trim()) return
    const userMsg = text.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg, source: 'protocol' }])
    setThinking(true)

    // First, try protocol matching (instant, offline)
    const matched = matchProtocols(alerts, userMsg)

    if (matched.length > 0) {
      // Protocol matched - respond immediately
      setTimeout(() => {
        matched.forEach((p, i) => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                (i === 0 ? `**${p.title}** - here's what to do now:\n\n` : '') +
                p.autonomous.map((s, j) => `${j + 1}. ${s}`).join('\n') +
                (p.earthQuestions.length
                  ? `\n\n**When Earth replies, ask:**\n${p.earthQuestions.map((q) => `• ${q}`).join('\n')}`
                  : '') +
                (p.redFlags.length
                  ? `\n\n🔴 **Escalate immediately if:** ${p.redFlags.join(', ')}`
                  : ''),
              protocol: p,
              source: 'protocol',
            },
          ])
        })
        setThinking(false)
      }, 150)
      return
    }

    // No protocol matched - try Groq if available
    if (groqAvailable) {
      askGroq(userMsg, alerts)
        .then((answer) => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: answer + '\n\nAI-generated (Groq), not from Mission Control. Check it against your protocols.',
              source: 'groq',
            },
          ])
        })
        .catch(() => {
          setGroqAvailable(false)
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                'Could not reach the AI service. I only have onboard protocols.\n\n' +
                'Describe symptoms or paste an alert title, and I\'ll match NASA guidance.',
              source: 'offline',
            },
          ])
        })
        .finally(() => setThinking(false))
    } else {
      // Offline fallback
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'I\'m running in offline mode (no Groq API key). I only have onboard protocols.\n\n' +
              'Describe symptoms or paste an alert title, and I\'ll match NASA guidance.',
            source: 'offline',
          },
        ])
        setThinking(false)
      }, 150)
    }
  }, [alerts, groqAvailable])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(input)
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
        {!groqAvailable && <WifiOff className="ai-offline-badge" size={12} aria-label="Offline mode" />}
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
              {groqAvailable && (
                <Zap className="ai-groq-badge" size={14} aria-label="AI answers on (Groq)" />
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
                {!groqAvailable && (
                  <p className="ai-offline-note">
                    <WifiOff size={14} aria-hidden="true" />
                    Onboard protocols only. Add <code>VITE_GROQ_API_KEY</code> for AI answers to other questions.
                  </p>
                )}
                <div className="ai-chips">
                  {['Irregular rhythm at 118', 'SpO₂ dropped to 91%', 'Sleep debt 14 hrs', 'Shoulder pain on ARED', 'Cabin CO₂ 4.5 mmHg'].map((q) => (
                    <button key={q} className="ai-chip" onClick={() => handleSend(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.role}`}>
                {msg.role === 'system' && <span className="ai-system-badge">URGENT</span>}
                <div className={`ai-bubble ${msg.source === 'groq' ? 'ai-bubble-groq' : msg.source === 'offline' ? 'ai-bubble-offline' : ''}`}>
                  {msg.content}
                </div>
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
                <span>{groqAvailable ? 'Asking the AI model…' : 'Matching protocols…'}</span>
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
            <Button onClick={() => handleSend(input)} disabled={!input.trim() || thinking} size="icon" aria-label={thinking ? 'Sending…' : 'Send message'}>
              {thinking ? (
                <Loader2 size={16} className="spin" aria-hidden="true" />
              ) : (
                <Send size={16} aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
