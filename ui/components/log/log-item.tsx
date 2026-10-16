import type { ReactNode } from 'react'

import type { SearchState } from '@ui/components/base'
import { Badge } from '@ui/components/ui/badge'
import { cn } from '@ui/lib/utils'

const TYPE_CLASS_NAMES: Record<string, string> = {
  error: 'text-destructive',
  err: 'text-destructive',
  warning: 'text-warning',
  warn: 'text-warning',
  info: 'text-info',
  inf: 'text-info',
}

interface Props {
  value: ILogItem
  searchState?: SearchState
}

const LogItem = ({ value, searchState }: Props) => {
  const renderHighlightText = (text: string) => {
    if (!searchState?.text.trim()) return text

    try {
      const searchText = searchState.text
      let pattern: string

      if (searchState.useRegularExpression) {
        try {
          new RegExp(searchText)
          pattern = searchText
        } catch {
          pattern = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        }
      } else {
        const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        pattern = searchState.matchWholeWord ? `\\b${escaped}\\b` : escaped
      }

      const flags = searchState.matchCase ? 'g' : 'gi'
      const regex = new RegExp(pattern, flags)
      const elements: ReactNode[] = []
      let lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = regex.exec(text)) !== null) {
        const start = match.index
        const matchText = match[0]

        if (matchText === '') {
          regex.lastIndex += 1
          continue
        }

        if (start > lastIndex) {
          elements.push(text.slice(lastIndex, start))
        }

        elements.push(
          <mark
            key={`highlight-${start}`}
            className="rounded-sm bg-warning/30 px-0.5 text-inherit"
          >
            {matchText}
          </mark>,
        )

        lastIndex = start + matchText.length
      }

      if (lastIndex < text.length) {
        elements.push(text.slice(lastIndex))
      }

      return elements.length ? elements : text
    } catch {
      return text
    }
  }

  const type = value.type.toLowerCase()

  return (
    <div className="mx-3 flex flex-col gap-1 border-b py-2 text-xs/snug select-text">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground tabular-nums">
          {renderHighlightText(value.time || '')}
        </span>
        <Badge
          variant="outline"
          data-type={type}
          className={cn('font-semibold uppercase', TYPE_CLASS_NAMES[type])}
        >
          {renderHighlightText(value.type)}
        </Badge>
      </div>
      <div className="wrap-anywhere">{renderHighlightText(value.payload)}</div>
    </div>
  )
}

export default LogItem
