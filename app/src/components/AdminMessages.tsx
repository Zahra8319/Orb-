import { useState } from 'react'
import { CREW } from '../sim/crew'
import { commsDelaySec, dayOf, formatClock, formatDelay, minuteOfDay } from '../sim/mission'
import { useEarthThread } from '../store/hooks'
import { useStore, type Message } from '../store/store'
import { Section } from './bits'

function stamp(t: number): string {
  return `Day ${dayOf(t)}, ${formatClock(minuteOfDay(t))}`
}

const SENDER: Record<Message['from'], string> = {
  me: 'Crew',
  earth: 'Flight surgeon',
  admin: 'Mission Control',
}

/**
 * Mission Control's side of the crew messages. Each in-flight crew member has
 * one thread, shared with their Ship and Earth page. What Earth sends reaches
 * the ship only after the one-way radio delay, the same as the flight surgeon.
 */
export function AdminMessages() {
  const t = useStore((s) => s.t)
  const send = useStore((s) => s.sendAdminMessage)
  const [crewId, setCrewId] = useState(CREW[0].id)
  const [draft, setDraft] = useState('')
  const thread = useEarthThread(crewId)
  const delay = commsDelaySec(t)
  const crew = CREW.find((c) => c.id === crewId) ?? CREW[0]

  return (
    <Section
      title="Messages with the crew"
      note={`One-way radio delay is ${formatDelay(delay)}. Messages from the ship appear here once they arrive; yours reach the crew after the same delay.`}
    >
      <div className="admin-actions" role="group" aria-label="Crew member">
        {CREW.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`admin-tab ${crewId === c.id ? 'active' : ''}`}
            aria-pressed={crewId === c.id}
            onClick={() => setCrewId(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <ul className="thread">
        {thread.map((m) => {
          const inTransit = m.from !== 'me' && t < m.arrivesAt
          return (
            /* Seen from Earth, Earth's own messages sit on the "me" side. */
            <li key={m.id} className="msg" data-from={m.from === 'me' ? 'crew' : 'me'}>
              <div className="msg-body">{m.text}</div>
              <div className="msg-meta">
                {m.from === 'me' ? crew.name : SENDER[m.from]}, {stamp(m.from === 'me' ? m.arrivesAt : m.sentAt)}
                {m.from !== 'me' && (inTransit ? `. Reaches the ship in ${formatDelay((m.arrivesAt - t) * 60)}` : '. Delivered')}
              </div>
            </li>
          )
        })}
      </ul>
      {thread.length === 0 && <p className="muted">No messages with {crew.name} yet.</p>}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          send(draft, crewId)
          setDraft('')
        }}
      >
        <label>
          <span className="visually-hidden">Message to {crew.name}</span>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Write to ${crew.name}`} />
        </label>
        <button className="btn" type="submit" disabled={!draft.trim()}>
          Send to the ship
        </button>
      </form>
    </Section>
  )
}
