import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CREW } from '../sim/crew'
import { MIN_PER_DAY } from '../sim/mission'
import { NO_SCENARIOS } from '../sim/scenarios'
import { shortestTurn } from './angle'
import { DayRing } from './DayRing'

const handDeg = (container: HTMLElement) => {
  const hand = container.querySelector<SVGGElement>('.ring-hand')!
  return Number(/rotate\((-?[\d.]+)deg\)/.exec(hand.style.transform)![1])
}

describe('shortestTurn', () => {
  it('takes the short way round', () => {
    expect(shortestTurn(10, 40)).toBe(30)
    expect(shortestTurn(40, 10)).toBe(-30)
    expect(shortestTurn(359, 1)).toBe(2)
    expect(shortestTurn(1, 359)).toBe(-2)
  })
})

describe('DayRing hand', () => {
  it('keeps moving forward through midnight instead of winding back a full turn', () => {
    const day = 10 * MIN_PER_DAY
    const { container, rerender } = render(<DayRing crew={CREW[0]} t={day - 2} scenarios={NO_SCENARIOS} />)
    const before = handDeg(container)
    expect(before).toBeCloseTo(359.5, 1)

    rerender(<DayRing crew={CREW[0]} t={day + 2} scenarios={NO_SCENARIOS} />)
    const after = handDeg(container)
    expect(after - before).toBeCloseTo(1, 1)

    rerender(<DayRing crew={CREW[0]} t={day + 6 * 60} scenarios={NO_SCENARIOS} />)
    expect(handDeg(container)).toBeCloseTo(360 + 90, 1)
  })
})
