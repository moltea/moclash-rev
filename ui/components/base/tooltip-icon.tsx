import { InfoIcon, type LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Button } from '@ui/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'

interface Props extends Omit<ComponentProps<typeof Button>, 'title'> {
  title?: string
  icon?: LucideIcon
}

export const TooltipIcon = ({
  title = '',
  icon: Icon = InfoIcon,
  ...props
}: Props) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          {...props}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  )
}
