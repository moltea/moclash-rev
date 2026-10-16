import { forwardRef, type ReactNode } from 'react'

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@ui/components/ui/card'
import { cn } from '@ui/lib/utils'

type IconColor =
  | 'primary'
  | 'secondary'
  | 'error'
  | 'warning'
  | 'info'
  | 'success'

interface EnhancedCardProps {
  title: ReactNode
  icon: ReactNode
  action?: ReactNode
  children: ReactNode
  iconColor?: IconColor
  minHeight?: number | string
  noContentPadding?: boolean
  className?: string
}

const ICON_COLOR_CLASSES: Record<IconColor, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-chart-2/10 text-chart-2',
  error: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
}

export const EnhancedCard = forwardRef<HTMLDivElement, EnhancedCardProps>(
  (
    {
      title,
      icon,
      action,
      children,
      iconColor = 'primary',
      minHeight,
      noContentPadding = false,
      className,
    },
    ref,
  ) => {
    return (
      <Card ref={ref} size="sm" className={cn('h-full', className)}>
        <CardHeader className="items-center border-b">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md [&_svg:not([class*=size-])]:size-4',
                ICON_COLOR_CLASSES[iconColor],
              )}
            >
              {icon}
            </div>
            <CardTitle
              className="min-w-0 flex-1 truncate"
              title={typeof title === 'string' ? title : undefined}
            >
              {title}
            </CardTitle>
          </div>
          {action && (
            <CardAction className="row-span-1 self-center">{action}</CardAction>
          )}
        </CardHeader>
        <CardContent
          className={cn('flex flex-1 flex-col', noContentPadding && 'px-0')}
          style={minHeight ? { minHeight } : undefined}
        >
          {children}
        </CardContent>
      </Card>
    )
  },
)

EnhancedCard.displayName = 'EnhancedCard'
