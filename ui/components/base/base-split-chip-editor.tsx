import { CodeIcon, LayoutGridIcon, XIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import { FieldDescription } from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'
import { Textarea } from '@ui/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

type BaseSplitChipEditorMode = 'visual' | 'advanced'

interface BaseSplitChipEditorProps {
  value?: string
  onChange: (value: string) => void
  disabled?: boolean
  error?: boolean
  helperText?: ReactNode
  placeholder?: string
  rows?: number
  separator?: string
  splitPattern?: RegExp
  defaultMode?: BaseSplitChipEditorMode
  showModeToggle?: boolean
  ariaLabel?: string
  addLabel?: ReactNode
  emptyLabel?: ReactNode
  modeLabels?: Partial<Record<BaseSplitChipEditorMode, ReactNode>>
  renderHeader?: (modeToggle: ReactNode) => ReactNode
}

const DEFAULT_SPLIT_PATTERN = /[,\n;\r]+/

const splitValue = (value: string, splitPattern: RegExp) =>
  value
    .split(splitPattern)
    .map((item) => item.trim())
    .filter(Boolean)

export const BaseSplitChipEditor = ({
  value = '',
  onChange,
  disabled = false,
  error = false,
  helperText,
  placeholder,
  rows = 4,
  separator = ',',
  splitPattern = DEFAULT_SPLIT_PATTERN,
  defaultMode = 'visual',
  showModeToggle = true,
  ariaLabel,
  addLabel,
  emptyLabel,
  modeLabels,
  renderHeader,
}: BaseSplitChipEditorProps) => {
  const { t } = useTranslation()
  const [mode, setMode] = useState<BaseSplitChipEditorMode>(defaultMode)
  const [draft, setDraft] = useState('')

  const resolvedLabels = useMemo(
    () => ({
      visual: modeLabels?.visual ?? t('shared.editorModes.visualization'),
      advanced: modeLabels?.advanced ?? t('shared.editorModes.advanced'),
      add: addLabel ?? t('shared.actions.new'),
      empty: emptyLabel ?? t('shared.statuses.empty'),
    }),
    [t, modeLabels, addLabel, emptyLabel],
  )

  const values = useMemo(
    () => splitValue(value, splitPattern),
    [value, splitPattern],
  )

  const items = useMemo(() => {
    const counts = new Map<string, number>()
    return values.map((item) => {
      const nextCount = (counts.get(item) ?? 0) + 1
      counts.set(item, nextCount)
      return { key: `${item}-${nextCount}`, value: item }
    })
  }, [values])

  const handleAddDraft = () => {
    const nextValues = splitValue(draft, splitPattern)
    if (!nextValues.length) return
    onChange([...values, ...nextValues].join(separator))
    setDraft('')
  }

  const handleRemoveItem = (index: number) => {
    onChange(values.filter((_, i) => i !== index).join(separator))
  }

  const nextMode = mode === 'visual' ? 'advanced' : 'visual'
  const toggleLabel =
    nextMode === 'visual' ? resolvedLabels.visual : resolvedLabels.advanced
  const ToggleIcon = nextMode === 'visual' ? LayoutGridIcon : CodeIcon
  const resolvedAriaLabel =
    ariaLabel ?? (typeof toggleLabel === 'string' ? toggleLabel : undefined)

  const modeToggle = showModeToggle ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={resolvedAriaLabel}
          onClick={() => {
            setMode(nextMode)
            if (nextMode === 'visual') setDraft('')
          }}
        >
          <ToggleIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{toggleLabel}</TooltipContent>
    </Tooltip>
  ) : null

  return (
    <>
      {renderHeader ? renderHeader(modeToggle) : modeToggle}
      {mode === 'visual' ? (
        <div className="flex flex-col gap-2">
          <div className="flex min-h-7 flex-wrap items-center gap-1">
            {items.length ? (
              items.map((item, index) => (
                <Badge key={item.key} variant="secondary" className="gap-0.5">
                  {item.value}
                  {!disabled && (
                    <button
                      type="button"
                      className="rounded-sm opacity-60 hover:opacity-100"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <XIcon />
                    </button>
                  )}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">
                {resolvedLabels.empty}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Input
              disabled={disabled}
              value={draft}
              placeholder={placeholder}
              aria-invalid={error}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleAddDraft()
                }
              }}
            />
            <Button
              variant="outline"
              onClick={handleAddDraft}
              disabled={disabled || !draft.trim()}
            >
              {resolvedLabels.add}
            </Button>
          </div>
          {helperText && (
            <FieldDescription className={cn(error && 'text-destructive')}>
              {helperText}
            </FieldDescription>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Textarea
            aria-invalid={error}
            disabled={disabled}
            rows={rows}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          {helperText && (
            <FieldDescription className={cn(error && 'text-destructive')}>
              {helperText}
            </FieldDescription>
          )}
        </div>
      )}
    </>
  )
}
