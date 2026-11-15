import type { ReactNode } from 'react'
import type { Level } from '../rules/alerts'


/** Each level has its own shape as well as its own colour. */
export function LevelIcon({ level }: { level: Level | 'todo' }) {
  if (level === 'todo') {
    return (
      <svg className="level-icon" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="2" fill="none" stroke="var(--nasa-grey)" strokeWidth="2" />
      </svg>
    )
  }
  if (level === 'watch') {
    return (
      <svg className="level-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="7" fill="none" stroke="var(--watch)" strokeWidth="3" />
        <circle cx="10" cy="10" r="2" fill="var(--ink)" />
      </svg>
    )
  }
  if (level === 'act') {
    return (
      <svg className="level-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 1.5 19 18H1Z" fill="var(--watch)" />
        <path d="M10 7v5.5M10 15v.5" stroke="var(--nasa-deep)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className="level-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 1h8l5 5v8l-5 5H6l-5-5V6Z" fill="var(--urgent)" />
      <path d="M10 5v6.5M10 14.5v.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

interface ReadoutProps {
  label: string
  value: ReactNode
  unit?: string
  note?: ReactNode
  level?: Level | null
  big?: boolean
  children?: ReactNode
}

export function Readout({ label, value, unit, note, level, big, children }: ReadoutProps) {
  return (
    <div className={big ? 'readout readout-big' : 'readout'} data-level={level ?? undefined}>
      <div className="readout-label">{label}</div>
      <div className="readout-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {note && (
        <div className="readout-note">
          {level && (
            <>
              <LevelIcon level={level} />{' '}
            </>
          )}
          {note}
        </div>
      )}
      {children}
    </div>
  )
}

/** A clock time whose colon pulses, so a still frame still reads as live time. */
export function ClockText({ time }: { time: string }) {
  const at = time.indexOf(':')
  if (at < 0) return <>{time}</>
  return (
    <>
      {time.slice(0, at)}
      <span className="clock-colon">:</span>
      {time.slice(at + 1)}
    </>
  )
}

export function Section({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      {note && <p className="section-note">{note}</p>}
      <div className="section-body">{children}</div>
    </section>
  )
}
