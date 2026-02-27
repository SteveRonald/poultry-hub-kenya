import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      expand={true}
      visibleToasts={5}
      toastOptions={{
        duration: 5000,
        style: {
          zIndex: 9999,
        },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: 
            "!bg-[#1eb32a] !text-white !border-[#1eb32a]",
          error: 
            "!bg-[#cc0000] !text-white !border-[#cc0000]",
          warning:
            "!bg-amber-500 !text-white !border-amber-500",
          info:
            "!bg-blue-600 !text-white !border-blue-600",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
