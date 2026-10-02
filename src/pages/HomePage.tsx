import { ComicHero } from '@/pages/home/ComicHero'
import { PageFrame } from '@/components/PageFrame'

export function HomePage() {
  return (
    <PageFrame title="Home" bare>
      <ComicHero />
    </PageFrame>
  )
}
