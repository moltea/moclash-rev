import type { ComponentProps } from 'react'

import { Card } from '@ui/components/ui/card'
import { cn } from '@ui/lib/utils'

export const ProfileBox = ({
  className,
  ...props
}: ComponentProps<typeof Card>) => (
  <Card
    size="sm"
    className={cn(
      'relative cursor-pointer gap-2 text-start text-muted-foreground transition-shadow hover:ring-foreground/20 aria-selected:ring-2 aria-selected:ring-primary',
      className,
    )}
    {...props}
  />
)
