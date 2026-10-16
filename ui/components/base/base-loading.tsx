import { Spinner } from '@ui/components/ui/spinner'
import { cn } from '@ui/lib/utils'

interface Props {
  className?: string
}

export const BaseLoading = ({ className }: Props) => {
  return <Spinner className={cn('text-muted-foreground', className)} />
}
