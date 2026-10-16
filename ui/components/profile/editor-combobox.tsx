import { ChevronsUpDownIcon, XIcon } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@ui/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@ui/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@ui/components/ui/popover'
import { cn } from '@ui/lib/utils'

interface BaseProps {
  options: string[]
  getLabel?: (option: string) => string
  placeholder?: string
  invalid?: boolean
  className?: string
}

interface SingleProps extends BaseProps {
  multiple?: false
  value?: string | null
  onChange: (value: string) => void
}

interface MultipleProps extends BaseProps {
  multiple: true
  value?: string[]
  onChange: (value: string[]) => void
}

type Props = SingleProps | MultipleProps

const identity = (option: string) => option

export const EditorCombobox = ({
  options,
  getLabel = identity,
  placeholder,
  invalid,
  className,
  multiple,
  value,
  onChange,
}: Props) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const selected = multiple ? (value ?? []) : value ? [value] : []

  const onSelectOption = (option: string) => {
    if (multiple) {
      const current = value ?? []
      onChange(
        current.includes(option)
          ? current.filter((v) => v !== option)
          : [...current, option],
      )
      return
    }
    onChange(option)
    setOpen(false)
  }

  const onRemove = (option: string) => {
    if (!multiple) return
    onChange((value ?? []).filter((v) => v !== option))
  }

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          tabIndex={0}
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn(
            'flex min-h-7 w-full min-w-0 cursor-pointer items-center gap-1 rounded-md border border-input bg-input/20 px-2 py-0.5 text-xs/relaxed transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:bg-input/30',
            className,
          )}
          onKeyDown={onTriggerKeyDown}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {selected.length === 0 && (
              <span className="truncate text-muted-foreground">
                {placeholder}
              </span>
            )}
            {!multiple && selected[0] !== undefined && (
              <span className="truncate" title={getLabel(selected[0])}>
                {getLabel(selected[0])}
              </span>
            )}
            {multiple &&
              selected.map((option) => (
                <Badge
                  key={option}
                  variant="secondary"
                  className="max-w-full pe-0.5"
                >
                  <span className="truncate" title={getLabel(option)}>
                    {getLabel(option)}
                  </span>
                  <button
                    type="button"
                    className="rounded-full opacity-60 hover:opacity-100"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(option)
                    }}
                  >
                    <XIcon className="size-2.5" />
                  </button>
                </Badge>
              ))}
          </div>
          <ChevronsUpDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-48 p-0"
      >
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{t('shared.statuses.empty')}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const label = getLabel(option)
                return (
                  <CommandItem
                    key={option}
                    value={option}
                    keywords={[label]}
                    title={label}
                    data-checked={selected.includes(option)}
                    onSelect={() => onSelectOption(option)}
                  >
                    <span className="truncate">{label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
