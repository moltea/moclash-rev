import { useLockFn } from 'ahooks'
import { CircleHelpIcon, GitBranchIcon, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { showNotice } from '@/services/notice-service'
import { openExternalUrl } from '@/utils/open-external-url'
import { BasePage } from '@ui/components/base'
import SettingClash from '@ui/components/setting/setting-clash'
import SettingSystem from '@ui/components/setting/setting-system'
import SettingVergeAdvanced from '@ui/components/setting/setting-verge-advanced'
import SettingVergeBasic from '@ui/components/setting/setting-verge-basic'
import { Button } from '@ui/components/ui/button'
import { ButtonGroup } from '@ui/components/ui/button-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'

const HeaderAction = ({
  title,
  icon: Icon,
  onClick,
}: {
  title: string
  icon: LucideIcon
  onClick: () => void
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={title}
        onClick={onClick}
      >
        <Icon />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{title}</TooltipContent>
  </Tooltip>
)

const SettingPage = () => {
  const { t } = useTranslation()

  const onError = (err: any) => {
    showNotice.error(err)
  }

  const toGithubRepo = useLockFn(() =>
    openExternalUrl('https://github.com/moltea/moclash-rev').catch(onError),
  )

  const toGithubDoc = useLockFn(() =>
    openExternalUrl('https://github.com/moltea/moclash-rev#readme').catch(
      onError,
    ),
  )

  return (
    <BasePage
      title={t('settings.page.title')}
      header={
        <ButtonGroup aria-label={t('settings.page.actionsGroupLabel')}>
          <HeaderAction
            title={t('settings.page.actions.manual')}
            icon={CircleHelpIcon}
            onClick={toGithubDoc}
          />
          <HeaderAction
            title={t('settings.page.actions.github')}
            icon={GitBranchIcon}
            onClick={toGithubRepo}
          />
        </ButtonGroup>
      }
    >
      <div className="@container">
        <div className="grid grid-cols-1 items-start gap-4 @2xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-4">
            <SettingSystem onError={onError} />
            <SettingClash onError={onError} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <SettingVergeBasic onError={onError} />
            <SettingVergeAdvanced onError={onError} />
          </div>
        </div>
      </div>
    </BasePage>
  )
}

export default SettingPage
