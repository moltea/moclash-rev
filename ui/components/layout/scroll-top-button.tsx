import { ChevronUpIcon } from 'lucide-react'

import { Button } from '@ui/components/ui/button'
import { cn } from '@ui/lib/utils'

interface Props {
  onClick: () => void
  show: boolean
  className?: string
}

export const ScrollTopButton = ({ onClick, show, className }: Props) => {
  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={onClick}
      className={cn(
        'absolute right-5 bottom-5 rounded-full shadow-sm transition-[opacity,visibility] duration-200',
        show ? 'visible opacity-100' : 'invisible opacity-0',
        className,
      )}
    >
      <ChevronUpIcon />
    </Button>
  )
}
