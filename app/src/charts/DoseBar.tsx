import { scaleLinear } from 'd3-scale'
import { useWidth } from './useWidth'

interface Props {
  prior: number
  mission: number
  /** Expected career total on arrival at Mars. */
  projected: number
  limit: number
}

/** Career radiation dose against the limit: earlier flights, this mission so far, and what is still to come. */
export function DoseBar({ prior, mission, projected, limit }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const h = 26
  const top = 30
  const max = Math.max(limit * 1.06, projected * 1.04)
  const x = scaleLinear().domain([0, max]).range([0, width])
  const now = prior + mission
  const gap = 2
  const label = `Career dose ${Math.round(now)} of ${limit} millisieverts. ${Math.round(prior)} from earlier flights, ${Math.round(mission)} from this mission. Expected ${Math.round(projected)} on arrival.`

  return (
    <div className="chart dose-bar" ref={ref}>
      <svg height={top + h + 44} role="img" aria-label={label}>
        <rect x={0} y={top} width={x(max)} height={h} fill="var(--light-track)" />
        {prior > 0 && <rect x={0} y={top} width={Math.max(0, x(prior) - gap)} height={h} fill="var(--series-2)" />}
        <rect x={x(prior)} y={top} width={Math.max(0, x(now) - x(prior))} height={h} fill="var(--series-1)" />
        <rect x={x(now) + gap} y={top} width={Math.max(0, x(projected) - x(now) - gap)} height={h} fill="var(--planned)" />

        {/* now */}
        <line x1={x(now)} x2={x(now)} y1={top - 8} y2={top + h + 8} stroke="var(--ink)" strokeWidth={2} />
        <text className="direct-label" x={x(now)} y={top - 14} textAnchor={x(now) > width - 120 ? 'end' : 'middle'}>
          Now {Math.round(now)} mSv
        </text>

        {/* limit */}
        <line x1={x(limit)} x2={x(limit)} y1={top - 8} y2={top + h + 8} stroke="var(--urgent)" strokeWidth={3} />
        <text className="direct-label" x={x(limit)} y={top + h + 24} textAnchor="end">
          Career limit {limit} mSv
        </text>

        <text x={0} y={top + h + 24}>
          0
        </text>
        <text x={Math.min(x(projected), x(limit) - 150)} y={top + h + 40} textAnchor="end">
          On arrival about {Math.round(projected)} mSv
        </text>
      </svg>
      <div className="legend" aria-hidden="true" style={{ marginTop: 8, marginBottom: 0 }}>
        {prior > 0 && (
          <span>
            <i className="swatch" style={{ background: 'var(--series-2)', borderRadius: 0 }} /> Earlier flights
          </span>
        )}
        <span>
          <i className="swatch" style={{ background: 'var(--series-1)', borderRadius: 0 }} /> This mission so far
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--planned)', borderRadius: 0 }} /> Rest of the transit
        </span>
      </div>
    </div>
  )
}
