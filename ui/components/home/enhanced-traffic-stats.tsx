import {
  ArrowDownIcon,
  ArrowUpIcon,
  CloudDownloadIcon,
  CloudUploadIcon,
  LinkIcon,
  MemoryStickIcon,
} from 'lucide-react'
import { type ReactNode, memo, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useConnectionSummaryData } from '@/hooks/use-connection-data'
import { useMemoryData } from '@/hooks/use-memory-data'
import { useTrafficData } from '@/hooks/use-traffic-data'
import { useVerge } from '@/hooks/use-verge'
import { useVisibility } from '@/hooks/use-visibility'
import parseTraffic from '@/utils/parse-traffic'
import { TrafficErrorBoundary } from '@ui/components/shared/traffic-error-boundary'
import { cn } from '@ui/lib/utils'

import {
  EnhancedCanvasTrafficGraph,
  type EnhancedCanvasTrafficGraphRef,
} from './enhanced-canvas-traffic-graph'

type StatColor =
  | 'primary'
  | 'secondary'
  | 'error'
  | 'warning'
  | 'info'
  | 'success'

interface StatCardProps {
  icon: ReactNode
  title: string
  value: string | number
  unit: string
  color: StatColor
  onClick?: () => void
}

const STAT_COLOR_CLASSES: Record<StatColor, { card: string; icon: string }> = {
  primary: {
    card: 'border-primary/15 bg-primary/5 hover:data-clickable:border-primary/30 hover:data-clickable:bg-primary/10',
    icon: 'bg-primary/10 text-primary',
  },
  secondary: {
    card: 'border-chart-2/15 bg-chart-2/5 hover:data-clickable:border-chart-2/30 hover:data-clickable:bg-chart-2/10',
    icon: 'bg-chart-2/10 text-chart-2',
  },
  error: {
    card: 'border-destructive/15 bg-destructive/5 hover:data-clickable:border-destructive/30 hover:data-clickable:bg-destructive/10',
    icon: 'bg-destructive/10 text-destructive',
  },
  warning: {
    card: 'border-warning/15 bg-warning/5 hover:data-clickable:border-warning/30 hover:data-clickable:bg-warning/10',
    icon: 'bg-warning/10 text-warning',
  },
  info: {
    card: 'border-info/15 bg-info/5 hover:data-clickable:border-info/30 hover:data-clickable:bg-info/10',
    icon: 'bg-info/10 text-info',
  },
  success: {
    card: 'border-success/15 bg-success/5 hover:data-clickable:border-success/30 hover:data-clickable:bg-success/10',
    icon: 'bg-success/10 text-success',
  },
}

const CompactStatCard = memo(
  ({ icon, title, value, unit, color, onClick }: StatCardProps) => {
    const colorClasses = STAT_COLOR_CLASSES[color] ?? STAT_COLOR_CLASSES.primary

    return (
      <div
        data-clickable={onClick ? '' : undefined}
        className={cn(
          'flex min-w-0 items-center gap-2 rounded-lg border p-2 transition-colors',
          onClick ? 'cursor-pointer hover:shadow-sm' : 'cursor-default',
          colorClasses.card,
        )}
        onClick={onClick}
      >
        <div
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4',
            colorClasses.icon,
          )}
        >
          {icon}
        </div>

        <div className="flex min-w-0 grow flex-col">
          <span className="truncate text-[0.625rem] text-muted-foreground">
            {title}
          </span>
          <div className="flex min-w-0 items-baseline gap-1">
            <span className="truncate text-sm font-semibold tabular-nums">
              {value}
            </span>
            <span className="shrink-0 text-[0.625rem] text-muted-foreground">
              {unit}
            </span>
          </div>
        </div>
      </div>
    )
  },
)

CompactStatCard.displayName = 'CompactStatCard'

export const EnhancedTrafficStats = () => {
  const { t } = useTranslation()
  const { verge } = useVerge()
  const trafficRef = useRef<EnhancedCanvasTrafficGraphRef>(null)
  const pageVisible = useVisibility()

  const trafficGraph = verge?.traffic_graph ?? true
  const displayMemory = verge?.enable_memory_usage ?? true

  const {
    response: { data: traffic },
  } = useTrafficData({ enabled: pageVisible })

  const {
    response: { data: memory },
  } = useMemoryData({ enabled: displayMemory && pageVisible })

  const {
    response: { data: connectionSummary },
  } = useConnectionSummaryData({ enabled: pageVisible })

  const parsedData = useMemo(() => {
    const [up, upUnit] = parseTraffic(traffic?.up || 0)
    const [down, downUnit] = parseTraffic(traffic?.down || 0)
    const [inuse, inuseUnit] = parseTraffic(memory?.inuse || 0)
    const [uploadTotal, uploadTotalUnit] = parseTraffic(traffic?.upTotal || 0)
    const [downloadTotal, downloadTotalUnit] = parseTraffic(
      traffic?.downTotal || 0,
    )

    return {
      up,
      upUnit,
      down,
      downUnit,
      inuse,
      inuseUnit,
      uploadTotal,
      uploadTotalUnit,
      downloadTotal,
      downloadTotalUnit,
      connectionsCount: connectionSummary?.activeConnectionCount,
    }
  }, [traffic, memory, connectionSummary])

  const trafficGraphComponent = useMemo(() => {
    if (!trafficGraph || !pageVisible) return null

    return (
      <div
        className="h-[130px] cursor-pointer overflow-hidden rounded-lg border border-border/50"
        onClick={() => trafficRef.current?.toggleStyle()}
      >
        <div className="relative h-full">
          <EnhancedCanvasTrafficGraph ref={trafficRef} />
        </div>
      </div>
    )
  }, [trafficGraph, pageVisible])

  const statCards = useMemo(() => {
    const cards: StatCardProps[] = [
      {
        icon: <ArrowUpIcon />,
        title: t('home.components.traffic.metrics.uploadSpeed'),
        value: parsedData.up,
        unit: `${parsedData.upUnit}/s`,
        color: 'secondary' as const,
      },
      {
        icon: <ArrowDownIcon />,
        title: t('home.components.traffic.metrics.downloadSpeed'),
        value: parsedData.down,
        unit: `${parsedData.downUnit}/s`,
        color: 'primary' as const,
      },
      {
        icon: <LinkIcon />,
        title: t('home.components.traffic.metrics.activeConnections'),
        value: parsedData.connectionsCount,
        unit: '',
        color: 'success' as const,
      },
      {
        icon: <CloudUploadIcon />,
        title: t('shared.labels.uploaded'),
        value: parsedData.uploadTotal,
        unit: parsedData.uploadTotalUnit,
        color: 'secondary' as const,
      },
      {
        icon: <CloudDownloadIcon />,
        title: t('shared.labels.downloaded'),
        value: parsedData.downloadTotal,
        unit: parsedData.downloadTotalUnit,
        color: 'primary' as const,
      },
    ]

    if (displayMemory) {
      cards.push({
        icon: <MemoryStickIcon />,
        title: t('home.components.traffic.metrics.memoryUsage'),
        value: parsedData.inuse,
        unit: parsedData.inuseUnit,
        color: 'error' as const,
      })
    }

    return cards
  }, [t, parsedData, displayMemory])

  return (
    <TrafficErrorBoundary
      onError={(error, errorInfo) => {
        console.error('[EnhancedTrafficStats] 组件错误:', error, errorInfo)
      }}
    >
      <div className="@container flex flex-col gap-2">
        {trafficGraph && trafficGraphComponent}
        <div className="grid grid-cols-2 gap-2 @xl:grid-cols-3">
          {statCards.map((card) => (
            <CompactStatCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </TrafficErrorBoundary>
  )
}
