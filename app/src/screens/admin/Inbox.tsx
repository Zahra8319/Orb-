import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CREW, crewById } from '../../sim/crew'
import { commsDelaySec, dayOf, formatClock, formatDelay, minuteOfDay } from '../../sim/mission'
import { useAwaitingReply } from '../../store/hooks'
import { useStore, type Message } from '../../store/store'

const stamp = (t: number) => `Day ${dayOf(t)}, ${formatClock(minuteOfDay(t))}`

/** Every crew member's messages to Earth, answered by the flight surgeon. */
export function Inbox() {
  const [params, setParams] = useSearchParams()
  const awaiting = useAwaitingReply()
  const selected = crewById(params.get('crew') ?? [...awaiting][0] ?? CREW[0].id)
  const t = useStore((s) => s.t)
  const messages = useStore((s) => s.messages)
  const replyAsEarth = useStore((s) => s.replyAsEarth)
  const [draft, setDraft] = useState('')

  // Earth only has a crew message once it has crossed the gap.
  const thread = messages.filter((m) => m.crewId === selected.id && (m.from === 'earth' || t >= m.arrivesAt))
  const incoming = messages.filter((m) => m.crewId === selected.id && m.from === 'me' && t < m.arrivesAt)
  const first = selected.name.split(' ')[0]

  return (
    <>
      <h1 className="page-title">Messages</h1>
      <p className="page-intro">
        Every message crosses {formatDelay(commsDelaySec(t))} of space each way, so answer so it stands on its own: the crew
        cannot ask a follow-up for {formatDelay(commsDelaySec(t) * 2)}.
      </p>

      <div className="mc-inbox section-body">
        <nav className="mc-inbox-list" aria-label="Crew conversations">
          <ul>
            {CREW.map((c) => (
              <li key={c.id}>
                <button
                  className="mc-inbox-item"
                  aria-current={c.id === selected.id ? 'true' : undefined}
                  onClick={() => setParams({ crew: c.id })}
                >
                  <span>{c.name}</span>
                  {awaiting.has(c.id) && <span className="count">Needs a reply</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-label={`Conversation with ${selected.name}`}>
          <div className="thread">
            {thread.length === 0 && <p className="empty">No messages from {first} yet.</p>}
            {thread.map((m) => (
              <EarthMessage key={m.id} m={m} now={t} name={first} />
            ))}
            {incoming.length > 0 && (
              <p className="msg-meta">
                {incoming.length === 1 ? 'A message' : `${incoming.length} messages`} from {first} on the way, arriving in{' '}
                {formatDelay(Math.max(0, (incoming[0].arrivesAt - t) * 60))}.
              </p>
            )}
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault()
              replyAsEarth(selected.id, draft)
              setDraft('')
              // Pin the conversation: answering takes this crew member off the
              // "needs a reply" list, which would otherwise move the default.
              setParams({ crew: selected.id }, { replace: true })
            }}
          >
            <label>
              <span className="visually-hidden">Reply to {selected.name}</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Reply to ${first}`}
              />
            </label>
            <button className="btn" type="submit" disabled={!draft.trim()}>
              Send to {first}
            </button>
          </form>
        </section>
      </div>
    </>
  )
}

function EarthMessage({ m, now, name }: { m: Message; now: number; name: string }) {
  const fromEarth = m.from === 'earth'
  const inTransit = fromEarth && now < m.arrivesAt
  return (
    // From Earth's side, our replies sit on the right like the crew's own messages do on board.
    <div className="msg" data-from={fromEarth ? 'me' : 'them'}>
      <div className="msg-body">{m.text}</div>
      <div className="msg-meta">
        {fromEarth
          ? inTransit
            ? `You, ${stamp(m.sentAt)}. Reaches the ship in ${formatDelay((m.arrivesAt - now) * 60)}.`
            : `You, ${stamp(m.sentAt)}. ${name} has it.`
          : `${name}, sent ${stamp(m.sentAt)}, reached Earth ${stamp(m.arrivesAt)}`}
      </div>
    </div>
  )
}
