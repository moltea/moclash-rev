import type { ComponentProps } from 'react'

import { cn } from '@ui/lib/utils'

export const TestBox = ({ className, ...props }: ComponentProps<'div'>) => (
  <div
    className={cn(
      'relative block w-full cursor-pointer rounded-lg bg-primary/5 px-3 py-2 text-left text-muted-foreground shadow-xs ring-1 ring-foreground/5 transition-[background-color,box-shadow] duration-300 hover:bg-primary/10 hover:shadow-sm [&_h2]:text-foreground aria-selected:[&_h2]:text-primary',
      className,
    )}
    {...props}
  />
)
