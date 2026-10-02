import { createPortal } from 'react-dom'

export function FxLayer() {
  if (typeof document === 'undefined') return null
  return createPortal(<div id="zi-fx-layer" className="pointer-events-none fixed inset-0 z-[60]" />, document.body)
}
