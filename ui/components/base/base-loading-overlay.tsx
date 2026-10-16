import { Spinner } from '@ui/components/ui/spinner'

interface Props {
  isLoading: boolean
}

export const BaseLoadingOverlay = ({ isLoading }: Props) => {
  if (!isLoading) return null

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
      <Spinner className="size-6" />
    </div>
  )
}
