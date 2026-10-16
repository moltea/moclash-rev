import { CpuIcon } from 'lucide-react'
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useClash } from '@/hooks/use-clash'
import { useDisplayedMixedPort } from '@/hooks/use-displayed-mixed-port'
import { useAppUptime } from '@/hooks/use-system-state'
import {
  useClashConfigData,
  useRulesData,
  useSystemData,
} from '@/providers/app-data-context'
import { Separator } from '@ui/components/ui/separator'

import { EnhancedCard } from './enhanced-card'

const formatUptime = (uptimeMs: number) => {
  const hours = Math.floor(uptimeMs / 3600000)
  const minutes = Math.floor((uptimeMs % 3600000) / 60000)
  const seconds = Math.floor((uptimeMs % 60000) / 1000)
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const ClashInfoCard = () => {
  const { t } = useTranslation()
  const { version: clashVersion } = useClash()
  const { clashConfig } = useClashConfigData()
  const displayedMixedPort = useDisplayedMixedPort()
  const { rules } = useRulesData()
  const uptime = useAppUptime()
  const { systemProxyAddress } = useSystemData()

  const formattedUptime = useMemo(() => formatUptime(uptime), [uptime])

  const cardContent = useMemo(() => {
    if (!clashConfig) return null

    const rows = [
      {
        label: t('home.components.clashInfo.fields.coreVersion'),
        value: clashVersion || '-',
      },
      {
        label: t('home.components.clashInfo.fields.systemProxyAddress'),
        value: systemProxyAddress,
      },
      {
        label: t('home.components.clashInfo.fields.mixedPort'),
        value: displayedMixedPort,
      },
      {
        label: t('home.components.clashInfo.fields.uptime'),
        value: formattedUptime,
      },
      {
        label: t('home.components.clashInfo.fields.rulesCount'),
        value: rules.length,
      },
    ]

    return (
      <div className="flex flex-col gap-2.5">
        {rows.map(({ label, value }, index) => (
          <Fragment key={label}>
            {index > 0 && <Separator />}
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{label}</span>
              <span className="truncate font-medium">{value}</span>
            </div>
          </Fragment>
        ))}
      </div>
    )
  }, [
    clashConfig,
    clashVersion,
    displayedMixedPort,
    t,
    formattedUptime,
    rules.length,
    systemProxyAddress,
  ])

  return (
    <EnhancedCard
      title={t('home.components.clashInfo.title')}
      icon={<CpuIcon />}
      iconColor="warning"
      action={null}
    >
      {cardContent}
    </EnhancedCard>
  )
}
