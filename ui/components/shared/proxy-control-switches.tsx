import { useLockFn } from 'ahooks'
import {
  CirclePauseIcon,
  CirclePlayIcon,
  SettingsIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react'
import { type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useServiceUninstaller } from '@/hooks/use-service-uninstaller'
import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useVerge } from '@/hooks/use-verge'
import { showNotice } from '@/services/notice-service'
import { requestService } from '@/services/service-request'
import { type DialogRef, TooltipIcon } from '@ui/components/base'
import { SysproxyViewer } from '@ui/components/setting/mods/sysproxy-viewer'
import { TunViewer } from '@ui/components/setting/mods/tun-viewer'
import { Switch } from '@ui/components/ui/switch'
import { cn } from '@ui/lib/utils'

interface ProxySwitchProps {
  label?: string
  onError?: (err: Error) => void
  noRightPadding?: boolean
}

interface SwitchRowProps {
  label: string
  active: boolean
  disabled?: boolean
  infoTitle: string
  onInfoClick?: () => void
  extraIcons?: ReactNode
  onToggle: (value: boolean) => Promise<boolean | void>
  onError?: (err: Error) => void
  highlight?: boolean
  noRightPadding?: boolean
}

const SwitchRow = ({
  label,
  active,
  disabled,
  infoTitle,
  onInfoClick,
  extraIcons,
  onToggle,
  onError,
  highlight,
  noRightPadding,
}: SwitchRowProps) => {
  const [checked, setChecked] = useState(active)
  const pendingRef = useRef(false)

  if (pendingRef.current) {
    if (active === checked) pendingRef.current = false
  } else if (checked !== active) {
    setChecked(active)
  }

  const handleChange = (value: boolean) => {
    pendingRef.current = true
    setChecked(value)
    onToggle(value)
      .then((applied) => {
        if (applied === false) setChecked(active)
      })
      .catch((err: any) => {
        setChecked(active)
        onError?.(err)
      })
      .finally(() => {
        pendingRef.current = false
      })
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2.5 rounded-md py-2.5 ps-3 transition-colors duration-300',
        noRightPadding ? 'pe-1' : 'pe-3',
        highlight && 'bg-success/10',
        disabled && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {active ? (
          <CirclePlayIcon className="size-4 shrink-0 text-success" />
        ) : (
          <CirclePauseIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate text-xs font-medium">{label}</span>
        <div className="flex items-center gap-0.5">
          <TooltipIcon
            title={infoTitle}
            icon={SettingsIcon}
            onClick={onInfoClick}
          />
          {extraIcons}
        </div>
      </div>

      <Switch
        disabled={disabled}
        checked={checked}
        onCheckedChange={handleChange}
      />
    </div>
  )
}

const ProxyControlSwitches = ({
  label,
  onError,
  noRightPadding = false,
}: ProxySwitchProps) => {
  const { t } = useTranslation()
  const { verge, mutateVerge, patchVerge } = useVerge()
  const { uninstallServiceAndStartSidecar } = useServiceUninstaller()
  const { indicator: systemProxyIndicator, toggleSystemProxy } =
    useSystemProxyState()
  const { runState, isTunModeAvailable, isLoading } = useSystemState()
  const isServiceInstallReady = runState.serviceUsable

  const sysproxyRef = useRef<DialogRef>(null)
  const tunRef = useRef<DialogRef>(null)

  const { enable_tun_mode } = verge ?? {}

  const handleSystemProxyToggle = async (value: boolean) => {
    if (value && !isLoading && runState.mode === 'NotRunning') {
      showNotice.error('settings.feedback.errors.sysproxy.coreNotReady')
      return false
    }
    await toggleSystemProxy(value)
  }

  const handleTunToggle = async (value: boolean) => {
    if (value && !isTunModeAvailable) {
      requestService({
        reason: 'tunNeedsService',
        restore: { enable_tun_mode: value },
      })
      return false
    }
    mutateVerge({ ...verge, enable_tun_mode: value }, false)
    await patchVerge({ enable_tun_mode: value })
  }

  const onUninstallService = useLockFn(async () => {
    try {
      await uninstallServiceAndStartSidecar()
    } catch (err) {
      showNotice.error(err)
    }
  })

  const isSystemProxyMode =
    label === t('settings.sections.system.toggles.systemProxy') || !label
  const isTunMode = label === t('settings.sections.system.toggles.tunMode')

  return (
    <div className="w-full">
      {isSystemProxyMode && (
        <SwitchRow
          label={t('settings.sections.proxyControl.fields.systemProxy')}
          active={systemProxyIndicator}
          infoTitle={t('settings.sections.proxyControl.tooltips.systemProxy')}
          onInfoClick={() => sysproxyRef.current?.open()}
          onToggle={handleSystemProxyToggle}
          onError={onError}
          highlight={systemProxyIndicator}
          noRightPadding={noRightPadding}
        />
      )}

      {isTunMode && (
        <SwitchRow
          label={t('settings.sections.proxyControl.fields.tunMode')}
          active={(enable_tun_mode && isTunModeAvailable) || false}
          infoTitle={t('settings.sections.proxyControl.tooltips.tunMode')}
          onInfoClick={() => tunRef.current?.open()}
          onToggle={handleTunToggle}
          onError={onError}
          highlight={(enable_tun_mode && isTunModeAvailable) || false}
          noRightPadding={noRightPadding}
          extraIcons={
            <>
              {!isTunModeAvailable && (
                <TooltipIcon
                  title={t(
                    'settings.sections.proxyControl.tooltips.tunUnavailable',
                  )}
                  icon={TriangleAlertIcon}
                  className="text-warning"
                />
              )}
              {isServiceInstallReady && (
                <TooltipIcon
                  title={t(
                    'settings.sections.proxyControl.actions.uninstallService',
                  )}
                  icon={Trash2Icon}
                  className="text-destructive"
                  onClick={onUninstallService}
                />
              )}
            </>
          }
        />
      )}

      <SysproxyViewer ref={sysproxyRef} />
      <TunViewer ref={tunRef} />
    </div>
  )
}

export default ProxyControlSwitches
