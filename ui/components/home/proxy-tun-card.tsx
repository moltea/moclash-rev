import {
  CircleHelpIcon,
  type LucideIcon,
  MonitorIcon,
  NetworkIcon,
} from 'lucide-react'
import { type FC, memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useSystemState } from '@/hooks/use-system-state'
import { useVerge } from '@/hooks/use-verge'
import { showNotice } from '@/services/notice-service'
import ProxyControlSwitches from '@ui/components/shared/proxy-control-switches'
import { ToggleGroup, ToggleGroupItem } from '@ui/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

const LOCAL_STORAGE_TAB_KEY = 'clash-verge-proxy-active-tab'

interface TabItem {
  value: string
  icon: LucideIcon
  label: string
  hasIndicator: boolean
}

interface TabDescriptionProps {
  description: string
  tooltipTitle: string
}

const TabDescription: FC<TabDescriptionProps> = memo(
  ({ description, tooltipTitle }) => (
    <div className="flex animate-in items-center justify-center gap-1 rounded-md bg-muted/50 px-3 py-2 text-center text-xs/relaxed break-words text-muted-foreground hyphens-auto duration-200 fade-in-0">
      {description}
      <Tooltip>
        <TooltipTrigger asChild>
          <CircleHelpIcon className="size-3.5 shrink-0 opacity-70" />
        </TooltipTrigger>
        <TooltipContent>{tooltipTitle}</TooltipContent>
      </Tooltip>
    </div>
  ),
)

export const ProxyTunCard: FC = () => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<string>(
    () => localStorage.getItem(LOCAL_STORAGE_TAB_KEY) || 'system',
  )

  const { verge } = useVerge()
  const { isTunModeAvailable } = useSystemState()
  const { indicator: systemProxyIndicator } = useSystemProxyState()

  const { enable_tun_mode } = verge ?? {}

  const handleError = (err: unknown) => {
    showNotice.error(err)
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    localStorage.setItem(LOCAL_STORAGE_TAB_KEY, tab)
  }

  const tabDescription = useMemo(() => {
    if (activeTab === 'system') {
      return {
        text: systemProxyIndicator
          ? t('home.components.proxyTun.status.systemProxyEnabled')
          : t('home.components.proxyTun.status.systemProxyDisabled'),
        tooltip: t('home.components.proxyTun.tooltips.systemProxy'),
      }
    } else {
      return {
        text: !isTunModeAvailable
          ? t('home.components.proxyTun.status.tunModeServiceRequired')
          : enable_tun_mode
            ? t('home.components.proxyTun.status.tunModeEnabled')
            : t('home.components.proxyTun.status.tunModeDisabled'),
        tooltip: t('home.components.proxyTun.tooltips.tunMode'),
      }
    }
  }, [activeTab, systemProxyIndicator, enable_tun_mode, isTunModeAvailable, t])

  const tabs: TabItem[] = [
    {
      value: 'system',
      icon: MonitorIcon,
      label: t('settings.sections.system.toggles.systemProxy'),
      hasIndicator: systemProxyIndicator,
    },
    {
      value: 'tun',
      icon: NetworkIcon,
      label: t('settings.sections.system.toggles.tunMode'),
      hasIndicator: !!enable_tun_mode && isTunModeAvailable,
    },
  ]

  return (
    <div className="flex w-full flex-col gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={activeTab}
        onValueChange={(value) => {
          if (value) handleTabChange(value)
        }}
        className="w-full"
      >
        {tabs.map(({ value, icon: Icon, label, hasIndicator }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            className="relative h-8 flex-1 shrink data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <Icon data-icon="inline-start" />
            <span className="truncate">{label}</span>
            {hasIndicator && (
              <span
                className={cn(
                  'absolute top-1.5 right-1.5 size-1.5 rounded-full',
                  activeTab === value ? 'bg-primary-foreground' : 'bg-success',
                )}
              />
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <TabDescription
        description={tabDescription.text}
        tooltipTitle={tabDescription.tooltip}
      />

      <div className="rounded-lg bg-muted/40 p-1">
        <ProxyControlSwitches
          onError={handleError}
          label={
            activeTab === 'system'
              ? t('settings.sections.system.toggles.systemProxy')
              : t('settings.sections.system.toggles.tunMode')
          }
          noRightPadding={true}
        />
      </div>
    </div>
  )
}
