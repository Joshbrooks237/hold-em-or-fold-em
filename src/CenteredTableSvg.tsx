import type { TableGeometry } from './tableLayout'

type Props = {
  geom: TableGeometry
  gradientId: string
}

/** D3-sized geometry; SVG draws a mathematically centered “pool” felt surface. */
export function CenteredTableSvg({ geom, gradientId }: Props) {
  const { cx, cy, rx, ry, railPad, width, height } = geom
  const outerRx = rx + railPad + 7
  const outerRy = ry + railPad + 7

  return (
    <svg
      className="table-svg"
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <radialGradient id={gradientId} cx="42%" cy="40%" r="68%">
          <stop offset="0%" stopColor="#1a6b4e" />
          <stop offset="55%" stopColor="#0f3d2c" />
          <stop offset="100%" stopColor="#071812" />
        </radialGradient>
        <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodOpacity="0.45" />
        </filter>
      </defs>
      <ellipse
        cx={cx}
        cy={cy}
        rx={outerRx + 2}
        ry={outerRy + 2}
        fill="#2a1810"
        opacity={0.95}
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={outerRx}
        ry={outerRy}
        fill="#3d2817"
        stroke="rgba(201, 162, 39, 0.35)"
        strokeWidth={2}
        filter={`url(#${gradientId}-shadow)`}
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={`url(#${gradientId})`}
        stroke="rgba(201, 162, 39, 0.45)"
        strokeWidth={1.5}
      />
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx * 0.88}
        ry={ry * 0.88}
        fill="none"
        stroke="rgba(0, 0, 0, 0.22)"
        strokeWidth={4}
      />
    </svg>
  )
}
