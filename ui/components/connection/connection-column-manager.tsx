import { arrayMove } from '@dnd-kit/helpers'
import {
  DragDropProvider,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import { GripVerticalIcon, RotateCcwIcon } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/ui/dropdown-menu'
import { cn } from '@ui/lib/utils'

const columnPointerSensor = PointerSensor.configure({
  activationConstraints: () => undefined,
})

export interface ConnectionColumnOption {
  id: string
  label: string
  visible: boolean
  toggleVisibility: (visible: boolean) => void
}

interface Props {
  open: boolean
  columns: ConnectionColumnOption[]
  onClose: () => void
  onOrderChange: (order: string[]) => void
  onReset: () => void
}

export const ConnectionColumnManager = ({
  open,
  columns,
  onClose,
  onOrderChange,
  onReset,
}: Props) => {
  const { t } = useTranslation()

  const visibleCount = useMemo(
    () => columns.filter((column) => column.visible).length,
    [columns],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { operation, canceled } = event
      const { source, target } = operation
      if (canceled || !target || !isSortable(source)) return

      const order = columns.map((column) => column.id)
      const { index: newIndex, initialIndex: oldIndex } = source.sortable
      if (
        oldIndex < 0 ||
        newIndex < 0 ||
        oldIndex >= order.length ||
        newIndex >= order.length ||
        oldIndex === newIndex
      ) {
        return
      }

      onOrderChange(arrayMove(order, oldIndex, newIndex))
    },
    [columns, onOrderChange],
  )

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute end-2.5 top-0 size-0"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuLabel>
          {t('connections.components.columnManager.title')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DragDropProvider
          sensors={[columnPointerSensor]}
          onDragEnd={handleDragEnd}
        >
          <DropdownMenuGroup className="flex flex-col gap-0.5">
            {columns.map((column, index) => (
              <SortableColumnItem
                key={column.id}
                id={column.id}
                index={index}
                column={column}
                dragHandleLabel={t(
                  'connections.components.columnManager.dragHandle',
                )}
                disableToggle={column.visible && visibleCount <= 1}
              />
            ))}
          </DropdownMenuGroup>
        </DragDropProvider>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onReset()
          }}
        >
          <RotateCcwIcon />
          {t('shared.actions.resetToDefault')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onClose}>
          {t('shared.actions.close')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface SortableColumnItemProps {
  id: string
  index: number
  column: ConnectionColumnOption
  dragHandleLabel: string
  disableToggle?: boolean
}

const SortableColumnItem = ({
  id,
  index,
  column,
  dragHandleLabel,
  disableToggle = false,
}: SortableColumnItemProps) => {
  const [element, setElement] = useState<Element | null>(null)
  const handleRef = useRef<HTMLButtonElement | null>(null)
  const { isDragging } = useSortable({
    id,
    index,
    element,
    handle: handleRef,
  })

  return (
    <div
      ref={setElement}
      className={cn(
        'flex items-center gap-0.5 rounded-md',
        isDragging && 'bg-popover shadow-md ring-1 ring-foreground/10',
      )}
    >
      <DropdownMenuCheckboxItem
        className="min-w-0 flex-1"
        checked={column.visible}
        disabled={disableToggle}
        onCheckedChange={(checked) => column.toggleVisibility(checked)}
        onSelect={(event) => event.preventDefault()}
      >
        <span className="truncate">{column.label}</span>
      </DropdownMenuCheckboxItem>
      <Button
        ref={handleRef}
        variant="ghost"
        size="icon-sm"
        className={cn(
          'text-muted-foreground',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        aria-label={dragHandleLabel}
      >
        <GripVerticalIcon />
      </Button>
    </div>
  )
}
