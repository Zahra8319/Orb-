import { scaleLinear } from 'd3-scale'
import { useState } from 'react'
import { useWidth } from './useWidth'

export interface Bar {
  label: string
  value: number
  /** Short axis label; shown only for some bars to avoid crowding. */
  tick?: string
}

interface Props {
  label: string
  bars: Bar[]
  yMax: number
  yFormat: (v: number) => string
  xHeader: string
  yHeader: string
  refLine?: { y: number; label: string }
  height?: number
}

/** Rounded top, square base, so every bar stays anchored to the baseline. */
function barPath(x: number, w: number, top: number, bottom: number): string {
  const r = Math.min(4, w / 2, Math.max(0, bottom - top))
  return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${bottom}Z`
}

export function BarChart({ label, bars, yMax, yFormat, xHeader, yHeader, refLine, height = 200 }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const m = { top: 18, right: 14, bottom: 28, left: 46 }
  const innerW = Math.max(60, width - m.left - m.right)
  const innerH = height - m.top - m.bottom
  const y = scaleLinear().domain([0, yMax]).range([innerH, 0])
  const band = innerW / bars.length
  const barW = Math.max(3, Math.min(34, band - 2))

  return (
    <figure>
      <div className="chart" ref={ref}>
        <svg height={height} role="img" aria-label={label}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(3).map((tick) => (
              <g key={tick} transform={`translate(0,${y(tick)})`}>
                <line className="grid-line" x1={0} x2={innerW} />
                <text x={-10} dy="0.32em" textAnchor="end">
                  {yFormat(tick)}
                </text>
              </g>
            ))}
            {bars.map((b, i) => {
              const cx = i * band + band / 2
              return (
                <g key={i}>
                  <path
                    d={barPath(cx - barW / 2, barW, y(Math.min(b.value, yMax)), innerH)}
                    fill="var(--series-1)"
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  />
                  {b.tick && (
                    <text x={cx} y={innerH + 19} textAnchor="middle">
                      {b.tick}
                    </text>
                  )}
                  <rect
                    x={i * band}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onPointerEnter={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                  />
                </g>
              )
            })}
            <line className="axis-line" x1={0} x2={innerW} y1={innerH} y2={innerH} />
            {refLine && (
              <g transform={`translate(0,${y(refLine.y)})`} pointerEvents="none">
                <line x1={0} x2={innerW} stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />
                <text className="ref-label" x={innerW} y={-5} textAnchor="end">
                  {refLine.label}
                </text>
              </g>
            )}
          </g>
        </svg>
        {hover !== null && (
          <div className="tooltip" style={{ left: m.left + hover * band + band / 2, top: m.top + y(Math.min(bars[hover].value, yMax)) }}>
            {bars[hover].label}
            <div>
              <b>{yFormat(bars[hover].value)}</b>
            </div>
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
                <th scope="col">{yHeader}</th>
              </tr>
            </thead>
            <tbody>
              {bars.map((b, i) => (
                <tr key={i}>
                  <td>{b.label}</td>
                  <td>{yFormat(b.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  )
}
