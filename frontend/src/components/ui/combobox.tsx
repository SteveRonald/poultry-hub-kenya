import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxOption {
  value: string | number
  label: string
  [key: string]: any
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string | number | null
  onValueChange: (value: string | number | null) => void
  onSearch?: (search: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  loading?: boolean
  className?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  onSearch,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No options found.",
  disabled = false,
  loading = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [triggerWidth, setTriggerWidth] = React.useState<number | undefined>(undefined)

  const selectedOption = options.find((option) => option.value === value)
  
  // Measure trigger width when it opens
  React.useEffect(() => {
    if (open && buttonRef.current) {
      setTriggerWidth(buttonRef.current.offsetWidth)
    }
  }, [open])
  
  // Debounce search and also trigger on empty to reload all options
  React.useEffect(() => {
    if (onSearch) {
      const timer = setTimeout(() => {
        onSearch(search)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [search, onSearch])
  
  // Reset search when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled || loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : selectedOption ? (
            <span className="truncate">{selectedOption.label}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0" 
        align="start"
        style={triggerWidth ? { width: `${triggerWidth}px` } : undefined}
      >
        <Command shouldFilter={!onSearch}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value === value ? null : option.value)
                    setOpen(false)
                    setSearch('')
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

