import type { ReactNode } from 'react'

import { cn } from '@ui/lib/utils'

import { BaseErrorBoundary } from './base-error-boundary'

interface Props {
  title?: ReactNode
  header?: ReactNode
  className?: string
  contentClassName?: string
  children?: ReactNode
  full?: boolean
}

export const BasePage = ({
  title,
  header,
  className,
  contentClassName,
  full,
  children,
}: Props) => {
  return (
    <BaseErrorBoundary>
      <div className={cn('flex size-full min-h-0 flex-col', className)}>
        <header
          data-tauri-drag-region="true"
          className="@container/page-header flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4"
        >
          <h1
            data-tauri-drag-region="true"
            className="min-w-16 truncate font-heading text-sm font-semibold"
          >
            {title}
          </h1>
          {header && (
            <div className="flex shrink-0 items-center gap-1.5">{header}</div>
          )}
        </header>

        <div
          className={cn(
            'relative min-h-0 flex-1',
            full ? 'overflow-hidden' : 'overflow-y-auto p-4',
            contentClassName,
          )}
        >
          {children}
        </div>
      </div>
    </BaseErrorBoundary>
  )
}
