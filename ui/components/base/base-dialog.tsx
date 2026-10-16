import type { ReactNode } from 'react'

import { Button } from '@ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/components/ui/dialog'
import { Spinner } from '@ui/components/ui/spinner'
import { cn } from '@ui/lib/utils'

interface Props {
  title: ReactNode
  open: boolean
  description?: ReactNode
  okBtn?: ReactNode
  cancelBtn?: ReactNode
  disableOk?: boolean
  disableCancel?: boolean
  disableFooter?: boolean
  className?: string
  contentClassName?: string
  children?: ReactNode
  loading?: boolean
  onOk?: () => void
  onCancel?: () => void
  onClose?: () => void
}

export interface DialogRef {
  open: () => void
  close: () => void
}

export const BaseDialog = ({
  open,
  title,
  description,
  children,
  okBtn,
  cancelBtn,
  disableCancel,
  disableOk,
  disableFooter,
  className,
  contentClassName,
  loading,
  onOk,
  onCancel,
  onClose,
}: Props) => {
  const hasDescription = !!description || typeof title === 'string'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose?.()
      }}
    >
      <DialogContent
        showCloseButton={!!onClose}
        {...(!hasDescription && { 'aria-describedby': undefined })}
        className={cn('flex max-h-[85vh] flex-col sm:max-w-md', className)}
        onInteractOutside={(e) => {
          if (!onClose) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {hasDescription && (
            <DialogDescription className={cn(!description && 'sr-only')}>
              {description ?? title}
            </DialogDescription>
          )}
        </DialogHeader>

        <div
          className={cn(
            '-mx-4 min-h-0 flex-1 overflow-y-auto px-4',
            contentClassName,
          )}
        >
          {children}
        </div>

        {!disableFooter && (
          <DialogFooter>
            {!disableCancel && (
              <Button variant="outline" onClick={onCancel}>
                {cancelBtn}
              </Button>
            )}
            {!disableOk && (
              <Button disabled={loading} onClick={onOk}>
                {loading && <Spinner data-icon="inline-start" />}
                {okBtn}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
