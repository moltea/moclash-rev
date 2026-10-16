import { useRef } from 'react'

import { useUpdate } from '@/hooks/use-update'
import type { DialogRef } from '@ui/components/base'
import { UpdateViewer } from '@ui/components/setting/mods/update-viewer'
import { Button } from '@ui/components/ui/button'

interface Props {
  className?: string
}

export const UpdateButton = (props: Props) => {
  const { className } = props
  const viewerRef = useRef<DialogRef>(null)

  const { updateInfo } = useUpdate()

  if (!updateInfo?.available) return null

  return (
    <>
      <UpdateViewer ref={viewerRef} />

      <Button
        variant="destructive"
        size="xs"
        className={className}
        onClick={() => viewerRef.current?.open()}
      >
        New
      </Button>
    </>
  )
}
