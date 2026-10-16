import { type LucideIcon, MonitorIcon, NetworkIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useVerge } from '@/hooks/use-verge'
import { showNotice } from '@/services/notice-service'
import { Switch } from '@ui/components/ui/switch'
import { cn } from '@ui/lib/utils'

interface SwitchTileProps {
  icon: LucideIcon
  label: string
  active: boolean
  disabled?: boolean
  hint?: string
  onToggle: (value: boolean) => Promise<boolean | void>
}

const SwitchTile = ({
  icon: Icon,
  label,
  active,
  disabled,
  hint,
  onToggle,
}: SwitchTileProps) => {
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
      .catch((error: unknown) => {
        setChecked(active)
        showNotice.error(error)
      })
      .finally(() => {
        pendingRef.current = false
      })
  }

  return (
    <label
      title={hint ?? label}
      className={cn(
        'flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors',
        checked && 'bg-success/10',
        disabled && 'opacity-60',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon
          className={cn(
            'size-4 shrink-0',
            checked ? 'text-success' : 'text-muted-foreground',
          )}
        />
        <span className="truncate text-xs font-medium">{label}</span>
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={handleChange}
      />
    </label>
  )
}

export const QuickPanelSwitches = () => {
  const { t } = useTranslation()
  const { verge, mutateVerge, patchVerge } = useVerge()
  const { indicator: systemProxyIndicator, toggleSystemProxy } =
    useSystemProxyState()
  const { runState, isTunModeAvailable, isLoading } = useSystemState()
  const tunActive = (verge?.enable_tun_mode && isTunModeAvailable) || false

  const handleSystemProxyToggle = async (value: boolean) => {
    if (value && !isLoading && runState.mode === 'NotRunning') {
      showNotice.error('settings.feedback.errors.sysproxy.coreNotReady')
      return false
    }
    await toggleSystemProxy(value)
  }

  const handleTunToggle = async (value: boolean) => {
    mutateVerge({ ...verge, enable_tun_mode: value }, false)
    await patchVerge({ enable_tun_mode: value })
  }

  return (
    <div className="flex flex-col gap-0.5">
      <SwitchTile
        icon={MonitorIcon}
        label={t('settings.sections.proxyControl.fields.systemProxy')}
        active={systemProxyIndicator}
        onToggle={handleSystemProxyToggle}
      />
      <SwitchTile
        icon={NetworkIcon}
        label={t('settings.sections.proxyControl.fields.tunMode')}
        active={tunActive}
        disabled={!isTunModeAvailable}
        hint={
          isTunModeAvailable
            ? undefined
            : t('settings.sections.proxyControl.tooltips.tunUnavailable')
        }
        onToggle={handleTunToggle}
      />
    </div>
  )
}
