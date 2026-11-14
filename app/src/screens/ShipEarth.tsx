import { useState } from 'react'
import { LineChart } from '../charts/LineChart'
import { Readout, Section } from '../components/bits'
import type { Level } from '../rules/alerts'
import { THRESHOLDS } from '../rules/alerts'
import { commsDelaySec, dayOf, formatClock, formatDelay, minuteOfDay } from '../sim/mission'
import { cabinAt } from '../sim/model'
import { useCrew, useSnapshot } from '../store/hooks'
import { useStore, type Message } from '../store/store'

const KM_PER_LIGHT_SECOND = 299_792

function stamp(t: number): string {
  return `Day ${dayOf(t)}, ${formatClock(minuteOfDay(t))}`
}

function MessageItem({ m, now }: { m: Message; now: number }) {
  const inTransit = now < m.arrivesAt
  const progress = Math.min(1, Math.max(0, (now - m.sentAt) / (m.arrivesAt - m.sentAt)))
  return (
    <li className="msg" data-from={m.from}>
      <div className="msg-body">{m.text}</div>
      <div className="msg-meta">
        {m.from === 'me' ? 'You' : 'Flight surgeon, Earth'}, {stamp(m.from === 'me' ? m.sentAt : m.arrivesAt)}
        {m.from === 'me' && (inTransit ? `. Reaches Earth in ${formatDelay((m.arrivesAt - now) * 60)}` : '. Delivered')}
      </div>
      {m.from === 'me' && inTransit && (
        <div className="transit" aria-hidden="true">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </li>
  )
}

export function ShipEarth() {
  const crew = useCrew()
  const t = useStore((s) => s.t)
  const scenarios = useStore((s) => s.scenarios)
  const messages = useStore((s) => s.messages)
  const sendMessage = useStore((s) => s.sendMessage)
  const snap = useSnapshot()
  const [draft, setDraft] = useState('')
  const { cabin } = snap

  const delay = commsDelaySec(t)
  const distance = (delay * KM_PER_LIGHT_SECOND) / 1_000_000

  const co2Level: Level | null =
    cabin.co2 > THRESHOLDS.co2.urgent ? 'urgent' : cabin.co2 > THRESHOLDS.co2.act ? 'act' : cabin.co2 > THRESHOLDS.co2.watch ? 'watch' : null
  const o2Level: Level | null = cabin.o2 < THRESHOLDS.o2.urgent ? 'urgent' : cabin.o2 < THRESHOLDS.o2.watch ? 'watch' : null

  // Last 6 hours of cabin CO2, one reading every 5 minutes.
  const co2 = Array.from({ length: 73 }, (_, i) => {
    const at = t - (72 - i) * 5
    return { x: at, y: cabinAt(at, scenarios).co2 }
  })

  // Replies from Earth stay hidden until the signal has had time to arrive.
  const thread = messages.filter((m) => m.crewId === crew.id && (m.from === 'me' || t >= m.arrivesAt))
  const waiting = messages.some((m) => m.crewId === crew.id && m.from === 'earth' && t < m.arrivesAt)

  return (
    <>
      <h1 className="page-title">Ship and Earth</h1>
      <p className="page-intro">
        The cabin is the only air you have, and help is a long radio delay away. This page watches both.
      </p>

      <Section title="Cabin air">
        <div className="cabin-grid">
          <Readout
            label="Carbon dioxide"
            value={cabin.co2.toFixed(1)}
            unit="mmHg"
            note={co2Level ? 'above the 3 mmHg target' : 'target is under 3'}
            level={co2Level}
          />
          <Readout
            label="Oxygen"
            value={cabin.o2.toFixed(1)}
            unit="kPa"
            note={o2Level ? 'below 19.5' : 'normal is 19.5 to 23'}
            level={o2Level}
          />
          <Readout label="Pressure" value={cabin.pressure.toFixed(1)} unit="kPa" note="sea level is 101.3" />
          <Readout label="Temperature" value={cabin.temperature.toFixed(1)} unit={'°C'} />
          <Readout label="Humidity" value={cabin.humidity} unit="%" />
          <Readout label="Noise" value={cabin.noise} unit="dBA" note="sleep quarters aim for under 50" />
        </div>
      </Section>

      <Section title="Carbon dioxide, last 6 hours" note="NASA's standard keeps the one-hour average at or under 3 mmHg. Crews have reported headaches above that.">
        <LineChart
          label="Cabin carbon dioxide over the last 6 hours"
          series={[{ name: 'CO2', points: co2 }]}
          xFormat={(x) => formatClock(minuteOfDay(x))}
          yFormat={(y) => y.toFixed(1)}
          xHeader="Ship time"
          yDomain={[1.5, Math.max(4.6, ...co2.map((p) => p.y)) + 0.4]}
          xTicks={[t - 360, t - 240, t - 120, t]}
          refs={[
            { y: THRESHOLDS.co2.watch, label: 'Target 3 mmHg', tone: 'watch' },
            { y: THRESHOLDS.co2.act, label: 'Act above 4 mmHg', tone: 'urgent' },
          ]}
          height={240}
        />
      </Section>

      <Section title="Earth">
        <div className="split">
          <div>
            <Readout big label="Radio delay, one way" value={formatDelay(delay)} />
            <dl className="facts" style={{ marginTop: 24 }}>
              <div>
                <dt>Soonest a reply can arrive</dt>
                <dd>{formatDelay(delay * 2)}</dd>
              </div>
              <div>
                <dt>Distance from Earth</dt>
                <dd>
                  {distance.toFixed(0)} <small>million km</small>
                </dd>
              </div>
            </dl>
            <p className="section-note" style={{ marginTop: 16 }}>
              Because of the delay, Orb&rsquo;s alerts tell you what to do straight away instead of waiting for Earth.
            </p>
          </div>

          <div>
            <h3 className="subhead">Messages with your flight surgeon</h3>
            <ul className="thread">
              {thread.map((m) => (
                <MessageItem key={m.id} m={m} now={t} />
              ))}
            </ul>
            {waiting && <p className="msg-meta">A reply is on its way from Earth.</p>}
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage(draft)
                setDraft('')
              }}
            >
              <label>
                <span className="visually-hidden">Message to your flight surgeon</span>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Describe what you noticed and when it started"
                />
              </label>
              <button className="btn" type="submit" disabled={!draft.trim()}>
                Send to Earth
              </button>
            </form>
          </div>
        </div>
      </Section>
    </>
  )
}
