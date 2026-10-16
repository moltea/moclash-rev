import { ArrowDownIcon, ArrowUpIcon, MemoryStickIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useMemoryData } from '@/hooks/use-memory-data'
import { useTrafficData } from '@/hooks/use-traffic-data'
import { useVerge } from '@/hooks/use-verge'
import { useVisibility } from '@/hooks/use-visibility'
import parseTraffic from '@/utils/parse-traffic'
import { LightweightTrafficErrorBoundary } from '@ui/components/shared/traffic-error-boundary'
import { cn } from '@ui/lib/utils'

import { TrafficGraph, type TrafficRef } from './traffic-graph'

export const LayoutTraffic = () => {
  const { t } = useTranslation()
  const { verge } = useVerge()

  const trafficGraph = verge?.traffic_graph ?? true
  const displayMemory = verge?.enable_memory_usage ?? true

  const trafficRef = useRef<TrafficRef>(null)
  const pageVisible = useVisibility()

  const {
    response: { data: traffic },
  } = useTrafficData({ enabled: pageVisible })
  const {
    response: { data: memory },
  } = useMemoryData({ enabled: displayMemory && pageVisible })

  useEffect(() => {
    if (trafficRef.current) {
      trafficRef.current.appendData({
        up: traffic?.up || 0,
        down: traffic?.down || 0,
        upTotal: traffic?.upTotal || 0,
        downTotal: traffic?.downTotal || 0,
      })
    }
  }, [traffic])

  const [up, upUnit] = parseTraffic(traffic?.up || 0)
  const [down, downUnit] = parseTraffic(traffic?.down || 0)
  const [inuse, inuseUnit] = parseTraffic(memory?.inuse || 0)

  const rowClass = 'flex items-center whitespace-nowrap'
  const iconClass = 'mr-2 size-4 shrink-0'
  const valClass = 'flex-[1_1_56px] text-center text-sm tabular-nums'
  const unitClass = 'flex-[0_1_27px] text-right text-xs text-muted-foreground'

  return (
    <LightweightTrafficErrorBoundary>
      <div className="relative select-none">
        {trafficGraph && pageVisible && (
          <div
            className="mb-1.5 h-15 w-full"
            onClick={() => trafficRef.current?.toggleStyle()}
          >
            <TrafficGraph ref={trafficRef} />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div
            title={`${t('home.components.traffic.metrics.uploadSpeed')}`}
            className={rowClass}
          >
            <ArrowUpIcon
              className={cn(
                iconClass,
                (traffic?.up || 0) > 0
                  ? 'text-chart-2'
                  : 'text-muted-foreground/50',
              )}
            />
            <span className={cn(valClass, 'text-chart-2')}>{up}</span>
            <span className={unitClass}>{upUnit}/s</span>
          </div>

          <div
            title={`${t('home.components.traffic.metrics.downloadSpeed')}`}
            className={rowClass}
          >
            <ArrowDownIcon
              className={cn(
                iconClass,
                (traffic?.down || 0) > 0
                  ? 'text-primary'
                  : 'text-muted-foreground/50',
              )}
            />
            <span className={cn(valClass, 'text-primary')}>{down}</span>
            <span className={unitClass}>{downUnit}/s</span>
          </div>

          {displayMemory && (
            <div
              title={`${t('home.components.traffic.metrics.memoryUsage')} `}
              className={cn(rowClass, 'cursor-auto')}
            >
              <MemoryStickIcon className={iconClass} />
              <span className={valClass}>{inuse}</span>
              <span className={unitClass}>{inuseUnit}</span>
            </div>
          )}
        </div>
      </div>
    </LightweightTrafficErrorBoundary>
  )
}
