import {
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  Trash2Icon,
  Undo2Icon,
} from 'lucide-react'

import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import { cn } from '@ui/lib/utils'

interface Props {
  type: 'prepend' | 'original' | 'delete' | 'append'
  ruleRaw: string
  onDelete: () => void
  onPrepend?: () => void
  onAppend?: () => void
}

export const RuleItem = (props: Props) => {
  const { type, ruleRaw, onDelete, onPrepend, onAppend } = props
  const isSortable = type === 'prepend' || type === 'append'
  const rule = ruleRaw.replace(',no-resolve', '')

  const ruleType = rule.match(/^[^,]+/)?.[0] ?? ''
  const proxyPolicy = rule.match(/[^,]+$/)?.[0] ?? ''
  const ruleContent = rule.slice(ruleType.length + 1, -proxyPolicy.length - 1)

  return (
    <div
      className={cn(
        'relative flex h-full items-center gap-2 rounded-lg px-3 py-2',
        type === 'original' && 'bg-muted',
        type === 'delete' && 'bg-destructive/15',
        isSortable && 'bg-success/15',
      )}
    >
      <div
        data-sortable-handle
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-1',
          isSortable && 'cursor-move',
        )}
      >
        <div
          title={ruleContent || '-'}
          className={cn(
            'truncate text-sm font-semibold text-foreground',
            type === 'delete' && 'line-through',
          )}
        >
          {ruleContent || '-'}
        </div>
        <div className="flex w-[62%] min-w-0 items-center justify-between gap-2">
          <Badge variant="outline" className="text-primary">
            {ruleType}
          </Badge>
          <span className="truncate text-muted-foreground">{proxyPolicy}</span>
        </div>
      </div>
      {type === 'prepend' && (
        <Button variant="ghost" size="icon-sm" onClick={onAppend}>
          <ArrowDownToLineIcon />
        </Button>
      )}
      {type === 'append' && (
        <Button variant="ghost" size="icon-sm" onClick={onPrepend}>
          <ArrowUpToLineIcon />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" onClick={onDelete}>
        {type === 'delete' ? <Undo2Icon /> : <Trash2Icon />}
      </Button>
    </div>
  )
}
