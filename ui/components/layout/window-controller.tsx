import { CopyIcon, MinusIcon, SquareIcon, XIcon } from 'lucide-react'
import {
  type PointerEvent,
  type Ref,
  useCallback,
  useImperativeHandle,
} from 'react'

import { useWindowControls } from '@/hooks/use-window'
import getSystem from '@/utils/get-system'
import { Button } from '@ui/components/ui/button'
import { cn } from '@ui/lib/utils'

const RESIZE_HANDLES = [
  {
    direction: 'North',
    className: 'top-0 right-3 left-3 h-1.5 cursor-ns-resize',
  },
  {
    direction: 'NorthEast',
    className: 'top-0 right-0 size-3 cursor-nesw-resize',
  },
  {
    direction: 'East',
    className: 'top-3 right-0 bottom-3 w-1.5 cursor-ew-resize',
  },
  {
    direction: 'SouthEast',
    className: 'right-0 bottom-0 size-3 cursor-nwse-resize',
  },
  {
    direction: 'South',
    className: 'right-3 bottom-0 left-3 h-1.5 cursor-ns-resize',
  },
  {
    direction: 'SouthWest',
    className: 'bottom-0 left-0 size-3 cursor-nesw-resize',
  },
  {
    direction: 'West',
    className: 'top-3 bottom-3 left-0 w-1.5 cursor-ew-resize',
  },
  {
    direction: 'NorthWest',
    className: 'top-0 left-0 size-3 cursor-nwse-resize',
  },
] as const

export const WindowResizeHandles = () => {
  const { currentWindow, maximized } = useWindowControls()

  const startResizeDragging = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return

      event.preventDefault()
      const direction = event.currentTarget.dataset.resizeDirection
      const handle = RESIZE_HANDLES.find((item) => item.direction === direction)

      if (handle) {
        void currentWindow
          .startResizeDragging(handle.direction)
          .catch((error) =>
            console.warn('[WindowResizeHandles] 调整窗口大小失败:', error),
          )
      }
    },
    [currentWindow],
  )

  if (getSystem() !== 'linux' || maximized) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-10000"
      data-tauri-drag-region="false"
      aria-hidden="true"
    >
      {RESIZE_HANDLES.map(({ direction, className }) => (
        <div
          key={direction}
          className={cn('pointer-events-auto absolute touch-none', className)}
          data-resize-direction={direction}
          onPointerDown={startResizeDragging}
        />
      ))}
    </div>
  )
}

export type WindowControlsHandle = ReturnType<typeof useWindowControls>

export const WindowControls = ({
  ref,
}: {
  ref?: Ref<WindowControlsHandle>
}) => {
  const OS = getSystem()
  const {
    currentWindow,
    maximized,
    minimize,
    close,
    toggleFullscreen,
    toggleMaximize,
  } = useWindowControls()

  useImperativeHandle(
    ref,
    () => ({
      currentWindow,
      maximized,
      minimize,
      close,
      toggleFullscreen,
      toggleMaximize,
    }),
    [
      currentWindow,
      maximized,
      minimize,
      close,
      toggleFullscreen,
      toggleMaximize,
    ],
  )

  const maximizeButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="cursor-default"
      onClick={toggleMaximize}
    >
      {maximized ? <CopyIcon /> : <SquareIcon />}
    </Button>
  )

  const minimizeButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="cursor-default"
      onClick={minimize}
    >
      <MinusIcon />
    </Button>
  )

  return (
    <div className="flex items-center gap-2">
      {OS === 'macos' && (
        <>
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-default"
            onClick={close}
          >
            <XIcon />
          </Button>
          {minimizeButton}
          {maximizeButton}
        </>
      )}

      {(OS === 'windows' || OS === 'linux') && (
        <>
          {minimizeButton}
          {maximizeButton}
          <Button
            variant="ghost"
            size="icon-sm"
            className="cursor-default hover:bg-destructive hover:text-white dark:hover:bg-destructive"
            onClick={close}
          >
            <XIcon />
          </Button>
        </>
      )}
    </div>
  )
}
