import { scaleLinear } from 'd3-scale'
import { line as d3line } from 'd3-shape'
import { useMemo, useState } from 'react'
import { useWidth } from './useWidth'

export interface Point {
  x: number
  y: number
}

export interface Series {
  name: string
  points: Point[]
  /** Second and third series differ by dash pattern as well as colour. */
  style?: 'solid' | 'dashed' | 'dotted'
  tone?: 1 | 2
}

export interface RefLine {
  y: number
  label: string
  tone?: 'neutral' | 'watch' | 'urgent'
}

interface Props {
  /** Read by screen readers in place of the picture. */
  label: string
  series: Series[]
  xFormat: (x: number) => string
  yFormat: (y: number) => string
  xHeader: string
  yDomain?: [number, number]
  xTicks?: number[]
  refs?: RefLine[]
  height?: number
  directLabels?: boolean
}

const DASH = { solid: undefined, dashed: '7 5', dotted: '2 5' } as const
const REF_COLOR = { neutral: 'var(--nasa-grey)', watch: 'var(--watch)', urgent: 'var(--urgent)' } as const

export function LineChart({
  label,
  series,
  xFormat,
  yFormat,
  xHeader,
  yDomain,
  xTicks,
  refs = [],
  height = 240,
  directLabels = false,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const m = { top: 14, right: directLabels ? 132 : 14, bottom: 28, left: 46 }
  const innerW = Math.max(60, width - m.left - m.right)
  const innerH = height - m.top - m.bottom

  const { x, y } = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    const xs = all.map((p) => p.x)
    const ys = all.map((p) => p.y).concat(refs.map((r) => r.y))
    const lo = yDomain ? yDomain[0] : Math.min(...ys)
    const hi = yDomain ? yDomain[1] : Math.max(...ys)
    const pad = yDomain ? 0 : (hi - lo || 1) * 0.12
    return {
      x: scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).range([0, innerW]),
      y: scaleLinear().domain([lo - pad, hi + pad]).range([innerH, 0]),
    }
  }, [series, refs, yDomain, innerW, innerH])

  const path = d3line<Point>()
    .x((p) => x(p.x))
    .y((p) => y(p.y))

  const base = series[0]?.points ?? []
  const hoverPoint = hover !== null ? base[hover] : null

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect()
    const target = x.invert(e.clientX - box.left)
    let best = 0
    for (let i = 1; i < base.length; i++) {
      if (Math.abs(base[i].x - target) < Math.abs(base[best].x - target)) best = i
    }
    setHover(best)
  }

  // Direct labels at the right-hand end, nudged apart so they never overlap.
  const ends = series
    .map((s, i) => ({ i, name: s.name, y: y(s.points[s.points.length - 1]?.y ?? 0) }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].y - ends[i - 1].y < 16) ends[i].y = ends[i - 1].y + 16
  }

  const color = (s: Series) => (s.tone === 2 ? 'var(--series-2)' : 'var(--series-1)')

  return (
    <figure>
      {series.length > 1 && (
        <div className="legend" aria-hidden="true">
          {series.map((s) => (
            <span key={s.name}>
              <svg viewBox="0 0 26 8">
                <line x1="0" y1="4" x2="26" y2="4" stroke={color(s)} strokeWidth="2" strokeDasharray={DASH[s.style ?? 'solid']} />
              </svg>
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div className="chart" ref={ref}>
        <svg height={height} role="img" aria-label={label}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(4).map((tick) => (
              <g key={tick} transform={`translate(0,${y(tick)})`}>
                <line className="grid-line" x1={0} x2={innerW} />
                <text x={-10} dy="0.32em" textAnchor="end">
                  {yFormat(tick)}
                </text>
              </g>
            ))}
            <line className="axis-line" x1={0} x2={innerW} y1={innerH} y2={innerH} />
            {(xTicks ?? x.ticks(Math.max(2, Math.floor(innerW / 110)))).map((tick) => (
              <text key={tick} x={x(tick)} y={innerH + 19} textAnchor="middle">
                {xFormat(tick)}
              </text>
            ))}

            {refs.map((r) => (
              <g key={r.label} transform={`translate(0,${y(r.y)})`}>
                <line x1={0} x2={innerW} stroke={REF_COLOR[r.tone ?? 'neutral']} strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />
                <text className="ref-label" x={4} y={-5}>
                  {r.label}
                </text>
              </g>
            ))}

            <g className="chart-series">
              {series.map((s) => (
                <path
                  key={s.name}
                  d={path(s.points) ?? undefined}
                  fill="none"
                  stroke={color(s)}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={DASH[s.style ?? 'solid']}
                />
              ))}
            </g>

            {directLabels &&
              ends.map((e) => (
                <text key={e.name} className="direct-label" x={innerW + 10} y={e.y} dy="0.32em">
                  {e.name}
                </text>
              ))}

            {hoverPoint && (
              <g>
                <line x1={x(hoverPoint.x)} x2={x(hoverPoint.x)} y1={0} y2={innerH} stroke="var(--ink)" strokeWidth={1} />
                {series.map((s) => {
                  const p = s.points[hover!]
                  if (!p) return null
                  return <circle key={s.name} cx={x(p.x)} cy={y(p.y)} r={4.5} fill={color(s)} stroke="var(--bg)" strokeWidth={2} />
                })}
              </g>
            )}
            <rect
              width={innerW}
              height={innerH}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </g>
        </svg>
        {hoverPoint && (
          <div className="tooltip" style={{ left: m.left + x(hoverPoint.x), top: m.top + y(Math.max(...series.map((s) => s.points[hover!]?.y ?? -Infinity))) }}>
            {xFormat(hoverPoint.x)}
            {series.map((s) => (
              <div key={s.name}>
                <b>{yFormat(s.points[hover!]?.y ?? 0)}</b> {series.length > 1 ? s.name : ''}
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="table-toggle">
        <summary>Show as a table</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{xHeader}</th>
                {series.map((s) => (
                  <th scope="col" key={s.name}>
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {thin(base).map(({ p, i }) => (
                <tr key={i}>
                  <td>{xFormat(p.x)}</td>
                  {series.map((s) => (
                    <td key={s.name}>{yFormat(s.points[i]?.y ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}

/** Keeps the table readable: at most about 30 rows, always including the latest. */
function thin(points: Point[]) {
  const step = Math.max(1, Math.ceil(points.length / 30))
  const rows: { p: Point; i: number }[] = []
  for (let i = points.length - 1; i >= 0; i -= step) rows.unshift({ p: points[i], i })
  return rows
}
