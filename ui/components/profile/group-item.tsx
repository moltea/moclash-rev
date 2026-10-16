import { Trash2Icon, Undo2Icon } from 'lucide-react'

import { useIconCache } from '@/hooks/use-icon-cache'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import { cn } from '@ui/lib/utils'

interface Props {
  type: 'prepend' | 'original' | 'delete' | 'append'
  group: IProxyGroupConfig
  onDelete: () => void
}

export const GroupItem = (props: Props) => {
  const { type, group, onDelete } = props
  const isSortable = type === 'prepend' || type === 'append'

  const iconCachePath = useIconCache({
    icon: group.icon,
    cacheKey: group.name.replaceAll(' ', ''),
  })

  return (
    <div
      className={cn(
        'relative flex h-full items-center gap-2 rounded-lg px-3 py-2',
        type === 'original' && 'bg-muted',
        type === 'delete' && 'bg-destructive/15',
        isSortable && 'bg-success/15',
      )}
    >
      {group?.icon?.trim().startsWith('http') && (
        <img
          alt={group.name}
          src={iconCachePath === '' ? group.icon : iconCachePath}
          className="me-1 w-8 shrink-0 rounded-md"
        />
      )}
      {group?.icon?.trim().startsWith('data') && (
        <img
          alt={group.name}
          src={group.icon}
          className="me-1 w-8 shrink-0 rounded-md"
        />
      )}
      {group?.icon?.trim().startsWith('<svg') && (
        <img
          alt={group.name}
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(group.icon)}`}
          className="me-1 w-8 shrink-0 rounded-md"
        />
      )}
      <div
        data-sortable-handle
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-1',
          isSortable && 'cursor-move',
        )}
      >
        <div
          className={cn(
            'truncate text-sm font-semibold text-foreground',
            type === 'delete' && 'line-through',
          )}
        >
          {group.name}
        </div>
        <Badge variant="outline" className="text-primary">
          {group.type}
        </Badge>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onDelete}>
        {type === 'delete' ? <Undo2Icon /> : <Trash2Icon />}
      </Button>
    </div>
  )
}
