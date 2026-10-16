import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from '@ui/components/ui/dialog'
import { cn } from '@ui/lib/utils'

interface Props {
  open: boolean
  title: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  className?: string
  contentClassName?: string
  children?: ReactNode
  onClose: () => void
}

export const EditorDialog = ({
  open,
  title,
  actions,
  footer,
  className,
  contentClassName,
  children,
  onClose,
}: Props) => {
  return (
    <Dialog
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPortal>
        <div
          aria-hidden
          className="fixed inset-0 isolate z-50 bg-black/80 duration-100 animate-in fade-in-0 supports-backdrop-filter:backdrop-blur-xs"
          onClick={onClose}
        />
      </DialogPortal>
      <DialogContent
        className={cn('flex h-[85vh] flex-col sm:max-w-6xl', className)}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if ((e.target as Element | null)?.closest?.('.monaco-editor')) {
            e.preventDefault()
          }
        }}
      >
        <DialogHeader className="flex-row items-center justify-between gap-2 pe-8">
          <DialogTitle className="truncate">{title}</DialogTitle>
          {actions}
        </DialogHeader>
        <DialogDescription className="sr-only">{title}</DialogDescription>
        <div className={cn('flex min-h-0 flex-1 flex-col', contentClassName)}>
          {children}
        </div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
