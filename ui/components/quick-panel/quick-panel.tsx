import {
  CircleOffIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  PowerIcon,
  ServerOffIcon,
} from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useI18n } from '@/hooks/use-i18n'
import { useProfiles } from '@/hooks/use-profiles'
import { useSystemState } from '@/hooks/use-system-state'
import { useVerge } from '@/hooks/use-verge'
import { useWindowControls } from '@/hooks/use-window'
import { useEventBus } from '@/services/bus'
import { exitApp, showMainWindow } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { revalidateQueries } from '@/services/query-client'
import getSystem from '@/utils/get-system'
import { NoticeManager } from '@ui/components/layout/notice-manager'
import { Button } from '@ui/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@ui/components/ui/empty'
import { Separator } from '@ui/components/ui/separator'
import { TooltipProvider } from '@ui/components/ui/tooltip'
import { useCustomTheme } from '@ui/hooks/use-custom-theme'
import { cn } from '@ui/lib/utils'

import { QuickPanelMode } from './quick-panel-mode'
import { QuickPanelProxies } from './quick-panel-proxies'
import { QuickPanelPower, QuickPanelSwitches } from './quick-panel-switches'

const OS = getSystem()

const REFRESH_ON_FOCUS = [
  ['getProxyView'],
  ['getClashConfig'],
  ['getVergeConfig'],
  ['getProfiles'],
  ['getSystemProxy'],
  ['getAutoProxy'],
] as const

const ignoreNotice = () => {}

const QuickPanelBody = () => {
  const { t } = useTranslation()
  const { profiles, current } = useProfiles()
  const { runState, isLoading } = useSystemState()

  if (profiles && !current) {
    return (
      <Empty className="min-h-0 p-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleOffIcon />
          </EmptyMedia>
          <EmptyTitle>{t('layout.components.quickPanel.noProfile')}</EmptyTitle>
          <EmptyDescription>
            {t('layout.components.quickPanel.noProfileDescription')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (!isLoading && runState.mode === 'NotRunning') {
    return (
      <Empty className="min-h-0 p-4">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ServerOffIcon />
          </EmptyMedia>
          <EmptyTitle>
            {t('layout.components.quickPanel.coreNotRunning')}
          </EmptyTitle>
          <EmptyDescription>
            {t('layout.components.quickPanel.coreNotRunningDescription')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <QuickPanelMode />
      <QuickPanelProxies />
    </>
  )
}

export const QuickPanel = () => {
  const { t } = useTranslation()
  const { ready } = useCustomTheme()
  const { verge } = useVerge()
  const { current } = useProfiles()
  const { switchLanguage } = useI18n()
  const { close, currentWindow } = useWindowControls()
  const language = verge?.language

  useEventBus(ignoreNotice)

  useEffect(() => {
    if (language) switchLanguage(language)
  }, [language, switchLanguage])

  useEffect(() => {
    const unlisten = currentWindow.onFocusChanged(({ payload }) => {
      if (payload) void revalidateQueries(REFRESH_ON_FOCUS)
    })
    return () => {
      void unlisten.then((fn) => fn())
    }
  }, [currentWindow])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (document.querySelector('[data-slot="select-content"]')) return
      void close()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [close])

  const openDashboard = () => {
    void mutate(() => showMainWindow(), {
      id: 'show-main-window',
      errorNotice: false,
    })
      .catch(() => {})
      .finally(() => close())
  }

  const quit = () => {
    void mutate(() => exitApp(), {
      id: 'exit-app',
      errorNotice: false,
    }).catch(() => {})
  }

  if (!ready) {
    return <div className="size-full" />
  }

  const profileName = current?.name ?? '-'

  return (
    <TooltipProvider delayDuration={300}>
      <NoticeManager position={verge?.notice_position} />
      <div
        className={cn(
          'flex size-full flex-col gap-3 overflow-hidden bg-background p-3 text-foreground',
          OS === 'macos' && 'rounded-xl border',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileTextIcon className="size-4" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[0.625rem] text-muted-foreground">
                {t('layout.components.quickPanel.profile')}
              </span>
              <span
                className="truncate text-sm font-medium"
                title={profileName}
              >
                {profileName}
              </span>
            </div>
          </div>
          <QuickPanelPower />
        </div>

        <QuickPanelBody />

        <Separator />
        <QuickPanelSwitches />
        <Separator />

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            className="min-w-0 flex-1"
            onClick={openDashboard}
          >
            <LayoutDashboardIcon data-icon="inline-start" />
            <span className="truncate">
              {t('layout.components.quickPanel.openDashboard')}
            </span>
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={quit}
          >
            <PowerIcon data-icon="inline-start" />
            {t('layout.components.quickPanel.quit')}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  )
}
