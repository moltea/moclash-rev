import { Trash2Icon, Undo2Icon } from 'lucide-react'

import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import { cn } from '@ui/lib/utils'

interface Props {
  type: 'prepend' | 'original' | 'delete' | 'append'
  proxy: IProxyConfig
  onDelete: () => void
}

export const ProxyItem = (props: Props) => {
  const { type, proxy, onDelete } = props
  const isSortable = type === 'prepend' || type === 'append'

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
          title={proxy.name}
          className={cn(
            'truncate text-sm font-semibold text-foreground',
            type === 'delete' && 'line-through',
          )}
        >
          {proxy.name}
        </div>
        <Badge variant="outline" className="text-primary">
          {proxy.type}
        </Badge>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onDelete}>
        {type === 'delete' ? <Undo2Icon /> : <Trash2Icon />}
      </Button>
    </div>
  )
}
