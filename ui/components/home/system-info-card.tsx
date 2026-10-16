import { useLockFn } from 'ahooks'
import {
  CirclePauseIcon,
  InfoIcon,
  PuzzleIcon,
  ServerIcon,
  SettingsIcon,
  ShieldUserIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useServiceInstaller } from '@/hooks/use-service-installer'
import { useSystemState } from '@/hooks/use-system-state'
import {
  useUpdate,
  updateLastCheckTime,
  readLastCheckTime,
} from '@/hooks/use-update'
import { useVerge } from '@/hooks/use-verge'
import { getSystemInfo } from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import { version as appVersion } from '@root/package.json'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import { Separator } from '@ui/components/ui/separator'
import { cn } from '@ui/lib/utils'

import { EnhancedCard } from './enhanced-card'

export const SystemInfoCard = () => {
  const { t } = useTranslation()
  const { verge, patchVerge } = useVerge()
  const navigate = useNavigate()
  const { runningMode, isAdminMode, isSidecarMode, mutateSystemState } =
    useSystemState()
  const { installServiceAndRestartCore } = useServiceInstaller()

  const { checkUpdate: triggerCheckUpdate, lastCheckUpdate } = useUpdate(true)

  const [osInfo, setOsInfo] = useState('')

  const lastCheckUpdateText = useMemo(
    () => (lastCheckUpdate ? new Date(lastCheckUpdate).toLocaleString() : '-'),
    [lastCheckUpdate],
  )

  useEffect(() => {
    getSystemInfo()
      .then((info) => {
        const sysName = info.system_name
        let sysVersion = info.system_version

        if (
          sysName &&
          sysVersion.toLowerCase().startsWith(sysName.toLowerCase())
        ) {
          sysVersion = sysVersion.substring(sysName.length).trim()
        }

        setOsInfo(`${sysName} ${sysVersion}`)
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!verge?.auto_check_update) return
    if (readLastCheckTime() !== null) return

    updateLastCheckTime()
    const timeoutId = window.setTimeout(() => {
      triggerCheckUpdate().catch(console.error)
    }, 5000)
    return () => window.clearTimeout(timeoutId)
  }, [verge?.auto_check_update, triggerCheckUpdate])

  const goToSettings = useCallback(() => {
    navigate('/settings')
  }, [navigate])

  const toggleAutoLaunch = useCallback(async () => {
    if (!verge) return
    try {
      await patchVerge({ enable_auto_launch: !verge.enable_auto_launch })
    } catch (err) {
      console.error('切换开机自启动状态失败:', err)
    }
  }, [verge, patchVerge])

  const handleRunningModeClick = useCallback(async () => {
    if (isSidecarMode || (isAdminMode && isSidecarMode)) {
      await installServiceAndRestartCore()
      await mutateSystemState()
    }
  }, [
    isSidecarMode,
    isAdminMode,
    installServiceAndRestartCore,
    mutateSystemState,
  ])

  const onCheckUpdate = useLockFn(async () => {
    try {
      const result = await triggerCheckUpdate()
      const info = result.data
      if (!info?.available) {
        showNotice.success(
          'settings.components.verge.advanced.notifications.latestVersion',
        )
      } else {
        showNotice.info('shared.feedback.notifications.updateAvailable', 2000)
        goToSettings()
      }
    } catch (err) {
      console.warn('update check failed:', err)
      showNotice.warning(err)
    }
  })

  const autoLaunchEnabled = useMemo(
    () => verge?.enable_auto_launch || false,
    [verge],
  )

  const runningModeClickable = isSidecarMode || (isAdminMode && isSidecarMode)

  const getModeIcon = () => {
    if (runningMode === 'NotRunning') {
      return (
        <CirclePauseIcon className="size-3.5 text-muted-foreground">
          <title>{t('home.components.systemInfo.badges.notRunning')}</title>
        </CirclePauseIcon>
      )
    }
    if (isAdminMode) {
      if (!isSidecarMode) {
        return (
          <>
            <ShieldUserIcon className="size-3.5 text-primary">
              <title>{t('home.components.systemInfo.badges.adminMode')}</title>
            </ShieldUserIcon>
            <ServerIcon className="size-3.5 text-success">
              <title>
                {t('home.components.systemInfo.badges.serviceMode')}
              </title>
            </ServerIcon>
          </>
        )
      }
      return (
        <ShieldUserIcon className="size-3.5 text-primary">
          <title>{t('home.components.systemInfo.badges.adminMode')}</title>
        </ShieldUserIcon>
      )
    } else if (isSidecarMode) {
      return (
        <PuzzleIcon className="size-3.5 text-info">
          <title>{t('home.components.systemInfo.badges.sidecarMode')}</title>
        </PuzzleIcon>
      )
    } else {
      return (
        <ServerIcon className="size-3.5 text-success">
          <title>{t('home.components.systemInfo.badges.serviceMode')}</title>
        </ServerIcon>
      )
    }
  }

  const getModeText = () => {
    if (runningMode === 'NotRunning') {
      return t('home.components.systemInfo.badges.notRunning')
    }
    if (isAdminMode) {
      if (!isSidecarMode) {
        return t('home.components.systemInfo.badges.adminServiceMode')
      }
      return t('home.components.systemInfo.badges.adminMode')
    } else if (isSidecarMode) {
      return t('home.components.systemInfo.badges.sidecarMode')
    } else {
      return t('home.components.systemInfo.badges.serviceMode')
    }
  }

  if (!verge) return null

  return (
    <EnhancedCard
      title={t('home.components.systemInfo.title')}
      icon={<InfoIcon />}
      iconColor="error"
      action={
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={goToSettings}
          title={t('home.components.systemInfo.actions.settings')}
          aria-label={t('home.components.systemInfo.actions.settings')}
        >
          <SettingsIcon />
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {t('home.components.systemInfo.fields.osInfo')}
          </span>
          <span className="truncate font-medium">{osInfo}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {t('home.components.systemInfo.fields.autoLaunch')}
          </span>
          <Badge
            asChild
            variant={autoLaunchEnabled ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer',
              autoLaunchEnabled && 'bg-success/15 text-success',
            )}
          >
            <button type="button" onClick={toggleAutoLaunch}>
              {autoLaunchEnabled
                ? t('shared.statuses.enabled')
                : t('shared.statuses.disabled')}
            </button>
          </Badge>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {t('home.components.systemInfo.fields.runningMode')}
          </span>
          <button
            type="button"
            onClick={handleRunningModeClick}
            disabled={!runningModeClickable}
            className={cn(
              'flex min-w-0 items-center gap-1 font-medium',
              runningModeClickable
                ? 'cursor-pointer underline underline-offset-2 hover:opacity-70'
                : 'cursor-default',
            )}
          >
            {getModeIcon()}
            <span className="truncate">{getModeText()}</span>
          </button>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {t('home.components.systemInfo.fields.lastCheckUpdate')}
          </span>
          <button
            type="button"
            onClick={onCheckUpdate}
            className="cursor-pointer truncate font-medium underline underline-offset-2 hover:opacity-70"
          >
            {lastCheckUpdateText}
          </button>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {t('home.components.systemInfo.fields.vergeVersion')}
          </span>
          <span className="font-medium">v{appVersion}</span>
        </div>
      </div>
    </EnhancedCard>
  )
}
