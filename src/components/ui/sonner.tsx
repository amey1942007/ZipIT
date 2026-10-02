import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

function subscribeMobile(onStoreChange: () => void) {
  const query = window.matchMedia("(max-width: 639px)")
  query.addEventListener("change", onStoreChange)
  return () => query.removeEventListener("change", onStoreChange)
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia("(max-width: 639px)").matches, () => false)

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position={mobile ? "top-center" : "bottom-right"}
      duration={4000}
      visibleToasts={3}
      icons={{
        success: (
          <CheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--zi-ivory)",
          "--normal-text": "var(--zi-ink)",
          "--normal-border": "var(--zi-ink)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "zi-toast cn-toast cut-sm border-[3px] shadow-hard",
          success: "border-l-[6px] border-l-comic-gold",
          error: "border-l-[6px] border-l-comic-red",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
