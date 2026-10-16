import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'

import { BaseDialog } from '@ui/components/base'

interface Props {
  open: boolean
  value: string
  title?: string
  onClose: () => void
}

export const QrViewer = (props: Props) => {
  const { open, value, title, onClose } = props
  const { t } = useTranslation()

  return (
    <BaseDialog
      open={open}
      title={title ?? t('profiles.modals.qrViewer.title')}
      className="sm:max-w-sm"
      disableFooter
      onClose={onClose}
    >
      <div className="flex justify-center rounded-md bg-white p-4">
        <QRCodeSVG value={value} size={256} level="M" />
      </div>
    </BaseDialog>
  )
}
