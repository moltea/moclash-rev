import {
  type LucideIcon,
  MonitorIcon,
  NetworkIcon,
  PowerIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useVerge } from '@/hooks/use-verge'
import { showNotice } from '@/services/notice-service'
import { Spinner } from '@ui/components/ui/spinner'
import { Switch } from '@ui/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

const POWER_STATE_KEY = 'moclash:quick-panel-power'

type PowerState = { systemProxy: boolean; tun: boolean }

const readPowerState = (): PowerState => {
  try {
    const raw = localStorage.getItem(POWER_STATE_KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<PowerState>) : {}
    const state = { systemProxy: !!parsed.systemProxy, tun: !!parsed.tun }
    return state.systemProxy || state.tun
      ? state
      : { systemProxy: true, tun: false }
  } catch {
    return { systemProxy: true, tun: false }
  }
}

const writePowerState = (state: PowerState) => {
  try {
    localStorage.setItem(POWER_STATE_KEY, JSON.stringify(state))
  } catch {}
}

const useProxyControls = () => {
  const { verge, mutateVerge, patchVerge } = useVerge()
  const { indicator: systemProxyIndicator, toggleSystemProxy } =
    useSystemProxyState()
  const { runState, isTunModeAvailable, isLoading } = useSystemState()
  const tunActive = (verge?.enable_tun_mode && isTunModeAvailable) || false

  const setSystemProxy = async (value: boolean) => {
    if (value && !isLoading && runState.mode === 'NotRunning') {
      showNotice.error('settings.feedback.errors.sysproxy.coreNotReady')
      return false
    }
    await toggleSystemProxy(value)
  }

  const setTun = async (value: boolean) => {
    mutateVerge({ ...verge, enable_tun_mode: value }, false)
    await patchVerge({ enable_tun_mode: value })
  }

  return {
    systemProxyIndicator,
    tunActive,
    isTunModeAvailable,
    setSystemProxy,
    setTun,
  }
}

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

export const QuickPanelPower = () => {
  const { t } = useTranslation()
  const {
    systemProxyIndicator,
    tunActive,
    isTunModeAvailable,
    setSystemProxy,
    setTun,
  } = useProxyControls()
  const [pending, setPending] = useState(false)
  const active = systemProxyIndicator || tunActive

  useEffect(() => {
    if (systemProxyIndicator || tunActive) {
      writePowerState({ systemProxy: systemProxyIndicator, tun: tunActive })
    }
  }, [systemProxyIndicator, tunActive])

  const toggle = async () => {
    if (active) {
      writePowerState({ systemProxy: systemProxyIndicator, tun: tunActive })
      if (systemProxyIndicator) await setSystemProxy(false)
      if (tunActive) await setTun(false)
      return
    }
    const saved = readPowerState()
    const tun = saved.tun && isTunModeAvailable
    const systemProxy = saved.systemProxy || !tun
    if (tun) await setTun(true)
    if (systemProxy) await setSystemProxy(true)
  }

  const handleClick = () => {
    setPending(true)
    toggle()
      .catch((error: unknown) => showNotice.error(error))
      .finally(() => setPending(false))
  }

  const label = active
    ? t('layout.components.quickPanel.powerOff')
    : t('layout.components.quickPanel.powerOn')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={pending}
          onClick={handleClick}
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-full border-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-95 disabled:opacity-70',
            active
              ? 'border-success bg-success/15 text-success shadow-[0_0_16px] shadow-success/30 hover:bg-success/25'
              : 'border-border bg-muted text-muted-foreground hover:border-foreground/30 hover:text-foreground',
          )}
        >
          {pending ? (
            <Spinner className="size-5" />
          ) : (
            <PowerIcon className="size-6" strokeWidth={2.5} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  )
}

export const QuickPanelSwitches = () => {
  const { t } = useTranslation()
  const {
    systemProxyIndicator,
    tunActive,
    isTunModeAvailable,
    setSystemProxy,
    setTun,
  } = useProxyControls()

  return (
    <div className="flex flex-col gap-0.5">
      <SwitchTile
        icon={MonitorIcon}
        label={t('settings.sections.proxyControl.fields.systemProxy')}
        active={systemProxyIndicator}
        onToggle={setSystemProxy}
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
        onToggle={setTun}
      />
    </div>
  )
}
