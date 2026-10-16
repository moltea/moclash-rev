import { useSortable } from '@dnd-kit/react/sortable'
import { type CSSProperties, type ReactNode, useCallback } from 'react'

import { cn } from '@ui/lib/utils'

export interface SortableItemRenderProps {
  ref: (element: HTMLElement | null) => void
  handleRef: (element: HTMLElement | null) => void
  style: CSSProperties
  isDragging: boolean
}

interface SortableItemProps {
  id: string
  index: number
  group?: string
  disabled?: boolean
  measureElement?: (element: HTMLDivElement | null) => void
  dataIndex?: number
  className?: string
  style?: CSSProperties
  children: ReactNode | ((props: SortableItemRenderProps) => ReactNode)
}

export const SortableItem = ({
  id,
  index,
  group,
  disabled,
  measureElement,
  dataIndex,
  className,
  children,
  style,
}: SortableItemProps) => {
  const { ref, handleRef, sortable, isDragging } = useSortable({
    id,
    index,
    group,
    disabled,
  })
  const setRef = useCallback(
    (element: HTMLDivElement | null) => {
      handleRef(element?.querySelector('[data-sortable-handle]') ?? null)
      ref(element)
      measureElement?.(element)
    },
    [handleRef, ref, measureElement],
  )

  const mergedStyle: CSSProperties = {
    ...style,
    ...(sortable.transition && {
      transition: `${sortable.transition.duration ?? 300}ms ${sortable.transition.easing ?? 'ease'} transform`,
    }),
  }

  if (typeof children === 'function') {
    return children({ ref, handleRef, style: mergedStyle, isDragging })
  }

  return (
    <div
      ref={setRef}
      data-index={dataIndex}
      style={mergedStyle}
      className={cn(
        'relative rounded-lg',
        isDragging && 'z-10 bg-card shadow-lg',
        className,
      )}
    >
      {children}
    </div>
  )
}
