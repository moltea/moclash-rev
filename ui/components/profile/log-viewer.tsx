import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { BaseDialog, BaseEmpty } from '@ui/components/base'
import { Badge } from '@ui/components/ui/badge'
import { Separator } from '@ui/components/ui/separator'

interface Props {
  open: boolean
  logInfo: [string, string][]
  onClose: () => void
}

export const LogViewer = (props: Props) => {
  const { open, logInfo, onClose } = props

  const { t } = useTranslation()

  return (
    <BaseDialog
      open={open}
      title={t('profiles.modals.logViewer.title')}
      className="sm:max-w-md"
      contentClassName="h-[300px] select-text"
      cancelBtn={t('shared.actions.close')}
      disableOk
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="flex flex-col gap-1">
        {logInfo.map(([level, log]) => (
          <Fragment key={`${level}-${log}`}>
            <div className="flex items-start gap-2 text-muted-foreground">
              <Badge
                variant={
                  level === 'error' || level === 'exception'
                    ? 'destructive'
                    : 'outline'
                }
                className="mt-0.5"
              >
                {level}
              </Badge>
              <span className="min-w-0 break-words">{log}</span>
            </div>
            <Separator />
          </Fragment>
        ))}
      </div>

      {logInfo.length === 0 && <BaseEmpty />}
    </BaseDialog>
  )
}
