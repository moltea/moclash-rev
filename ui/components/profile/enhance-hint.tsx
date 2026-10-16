import { InfoIcon } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@ui/components/ui/alert'

const stageHints = {
  globalMerge: 'profiles.modals.editor.enhance.globalMerge',
  globalScript: 'profiles.modals.editor.enhance.globalScript',
  profileMerge: 'profiles.modals.editor.enhance.profileMerge',
  profileScript: 'profiles.modals.editor.enhance.profileScript',
} as const

interface Props {
  stage: keyof typeof stageHints
}

export const EnhanceHint = ({ stage }: Props) => {
  const { t } = useTranslation()
  const orderComponents = Object.fromEntries(
    Object.keys(stageHints).map((key) => [
      key,
      key === stage ? (
        <strong
          key={key}
          className="rounded-sm bg-primary px-1 font-bold text-primary-foreground [box-decoration-break:clone]"
        />
      ) : (
        <span key={key} />
      ),
    ]),
  )

  return (
    <Alert className="shrink-0">
      <InfoIcon className="text-info" />
      <AlertDescription className="flex flex-col gap-1">
        <span>{t(stageHints[stage])}</span>
        <span>
          <Trans
            defaults={t('profiles.modals.editor.enhance.order')}
            components={orderComponents}
          />
        </span>
        <span>{t('profiles.modals.editor.enhance.settingsPriority')}</span>
      </AlertDescription>
    </Alert>
  )
}
