import { scaleLinear } from 'd3-scale'
import { line as d3line } from 'd3-shape'
import { useWidth } from './useWidth'

interface Props {
  values: number[]
  height?: number
  /** Marks the newest value with the "live" colour. */
  live?: boolean
}

/** A small unlabelled trend line. Always sits next to a written value, so it is decorative for screen readers. */
export function TrendStrip({ values, height = 40, live = false }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>(240)
  if (values.length < 2) return <div ref={ref} style={{ height }} />
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pad = (hi - lo || 1) * 0.15
  const x = scaleLinear().domain([0, values.length - 1]).range([2, width - 7])
  const y = scaleLinear().domain([lo - pad, hi + pad]).range([height - 5, 5])
  const d = d3line<number>()
    .x((_, i) => x(i))
    .y((v) => y(v))(values)
  const last = values[values.length - 1]
  return (
    <div className="chart" ref={ref} aria-hidden="true">
      <svg height={height}>
        <path d={d ?? undefined} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(values.length - 1)} cy={y(last)} r={4.5} fill={live ? 'var(--live)' : 'var(--series-1)'} stroke="var(--bg)" strokeWidth={2} />
      </svg>
    </div>
  )
}
