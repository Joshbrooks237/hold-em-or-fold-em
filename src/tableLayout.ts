import { pointRadial } from 'd3'
import { scaleLinear } from 'd3-scale'

/** Polar degrees from top (12 o'clock); seat 0 is human at bottom */
export const SEAT_DEG = [190, 245, 305, 25, 85, 135] as const

export type TableGeometry = {
  width: number
  height: number
  cx: number
  cy: number
  rx: number
  ry: number
  railPad: number
  orbit: number
}

const orbitScale = scaleLinear<number, number>().domain([260, 520]).range([88, 158]).clamp(true)
const railScale = scaleLinear<number, number>().domain([280, 640]).range([6, 12]).clamp(true)

export function computeTableGeometry(width: number, height: number): TableGeometry {
  const cx = width / 2
  const cy = height / 2
  const minDim = Math.min(width, height)
  return {
    width,
    height,
    cx,
    cy,
    rx: width * 0.405,
    ry: height * 0.385,
    railPad: railScale(minDim),
    orbit: orbitScale(minDim),
  }
}

export function computeSeatPositions(
  geom: TableGeometry,
  seatDeg: readonly number[] = SEAT_DEG,
): { x: number; y: number }[] {
  return seatDeg.map((deg) => {
    const [dx, dy] = pointRadial((deg * Math.PI) / 180, geom.orbit)
    return { x: geom.cx + dx, y: geom.cy + dy }
  })
}
