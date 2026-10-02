import { ActionButton } from '@/components/comic/ActionButton'
import { Panel } from '@/components/comic/Panel'
import { usePageTitle } from '@/components/shell/Shell'

export function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <main id="main" tabIndex={-1} className="zi-fade mx-auto w-full max-w-[1280px] px-4 py-8 outline-none sm:px-6">
      <Panel fill="ivory" ghost="404" className="grid min-h-80 place-items-start gap-4 p-6 sm:p-10">
        <h2 className="text-ink">Page not found</h2>
        <p className="font-medium text-ink">That page doesn&apos;t exist.</p>
        <ActionButton to="/">Go home</ActionButton>
      </Panel>
    </main>
  )
}
