import { curlPolygons, type Poly } from '@/motion/pageTurn'

function pts(points: Poly): string {
  return points.map((point) => point.join(',')).join(' ')
}

export function CurlOverlay({ c, width, height }: { c: number; width: number; height: number }) {
  const { flap, shadow } = curlPolygons(width, height, c)
  return (
    <svg className="pointer-events-none fixed inset-0 z-[51] h-screen w-screen" aria-hidden>
      <polygon points={pts(shadow)} fill="rgba(0,0,0,.45)" />
      <polygon points={pts(flap)} fill="#FFF6E8" stroke="#FFC83D" strokeWidth="2" />
    </svg>
  )
}
