import { pointerIntersection } from '@dnd-kit/collision'
import { Feedback } from '@dnd-kit/dom'
import { DOMRectangle, supportsPopover } from '@dnd-kit/dom/utilities'
import { useDraggable, useDroppable } from '@dnd-kit/react'
import { type ReactNode, useCallback } from 'react'

import { cn } from '@ui/lib/utils'

const headerFeedbackPlugins = [
  Feedback.configure({
    feedback: (source, manager) => {
      if (supportsPopover(document.body)) return 'default'

      if (source.element && manager.dragOperation.status.initialized) {
        const { x, y } = manager.dragOperation.transform
        manager.dragOperation.shape = new DOMRectangle(
          source.element,
        ).translate(x, y)
      }
      return 'none'
    },
  }),
]

interface ProxyGroupHeaderBlockProps {
  group: string
  block: 'name' | 'tools'
  className?: string
  children: ReactNode
}

export const ProxyGroupHeaderBlock = ({
  group,
  block,
  className,
  children,
}: ProxyGroupHeaderBlockProps) => {
  const id = `${group}:${block}`
  const counterpart = `${group}:${block === 'name' ? 'tools' : 'name'}`
  const { ref: draggableRef, isDragging } = useDraggable({
    id,
    type: id,
    plugins: headerFeedbackPlugins,
  })
  const { ref: droppableRef, isDropTarget } = useDroppable({
    id,
    accept: counterpart,
    collisionDetector: pointerIntersection,
  })
  const setRef = useCallback(
    (element: Element | null) => {
      draggableRef(element)
      droppableRef(element)
    },
    [draggableRef, droppableRef],
  )

  return (
    <div
      ref={setRef}
      tabIndex={-1}
      className={cn(
        'flex min-w-0 items-center rounded-md outline-none',
        isDragging && 'bg-card shadow-md',
        isDropTarget && 'bg-primary/10',
        className,
      )}
    >
      {children}
    </div>
  )
}
