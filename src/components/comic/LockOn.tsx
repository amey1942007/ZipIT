export function LockOn({ label, shown = true }: { label?: string; shown?: boolean }) {
  if (!shown) return null
  return (
    <div aria-hidden className="zi-lock">
      <i />
      <i />
      <i />
      <i />
      {label ? <span className="zi-tm">{label}</span> : null}
    </div>
  )
}
