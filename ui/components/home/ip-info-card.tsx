import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useEffect } from 'foxact/use-abortable-effect'
import { useIntersection } from 'foxact/use-intersection'
import type { XOR } from 'foxts/ts-xor'
import { EyeIcon, EyeOffIcon, MapPinIcon, RefreshCwIcon } from 'lucide-react'
import {
  forwardRef,
  memo,
  useCallback,
  useEffectEvent,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { getIpInfo } from '@/services/api'
import { useQuery } from '@/services/query-client'
import getSystem from '@/utils/get-system'
import { Button } from '@ui/components/ui/button'
import { Separator } from '@ui/components/ui/separator'
import { Skeleton } from '@ui/components/ui/skeleton'

import { EnhancedCard } from './enhanced-card'

const IP_REFRESH_SECONDS = 300
const COUNTDOWN_TICK_INTERVAL = 5_000
const IP_INFO_CACHE_KEY = 'cv_ip_info_cache'

const InfoItem = memo(({ label, value }: { label: string; value?: string }) => (
  <div className="mb-1.5 flex items-start gap-1">
    <span className="shrink-0 text-right text-muted-foreground">{label}:</span>
    <span className="grow overflow-hidden text-ellipsis break-words whitespace-normal">
      {value || 'Unknown'}
    </span>
  </div>
))

const getCountryFlag = (countryCode: string | undefined) => {
  if (!countryCode) return ''
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}

type CountDownState = XOR<
  {
    type: 'countdown'
    remainingSeconds: number
  },
  {
    type: 'revalidating'
  }
>

const IPInfoCardContainer = forwardRef<HTMLDivElement, React.PropsWithChildren>(
  ({ children }, ref) => {
    const { t } = useTranslation()
    const { refetch: mutate } = useIPInfo()

    return (
      <EnhancedCard
        title={t('home.components.ipInfo.title')}
        icon={<MapPinIcon />}
        iconColor="info"
        ref={ref}
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => mutate()}
            aria-label={t('shared.actions.refresh')}
          >
            <RefreshCwIcon />
          </Button>
        }
      >
        {children}
      </EnhancedCard>
    )
  },
)

export const IpInfoCard = () => {
  const { t } = useTranslation()
  const [showIp, setShowIp] = useState(false)
  const appWindow = useMemo(() => getCurrentWebviewWindow(), [])

  const [containerRef, hasIntersected, _resetIntersected] = useIntersection({
    rootMargin: '0px',
  })

  const [countdown, setCountdown] = useState<CountDownState>({
    type: 'countdown',
    remainingSeconds: IP_REFRESH_SECONDS,
  })

  const { data: ipInfo, error, isLoading, refetch: mutate } = useIPInfo()

  const onCountdownTick = useEffectEvent(async () => {
    const now = Date.now()
    const ts = ipInfo?.lastFetchTs
    if (!ts) {
      return
    }

    const elapsed = Math.floor((now - ts) / 1000)
    const remaining = IP_REFRESH_SECONDS - elapsed

    if (remaining <= 0) {
      if (
        hasIntersected &&
        navigator.onLine &&
        countdown.type !== 'revalidating' &&
        (await appWindow.isVisible())
      ) {
        setCountdown({ type: 'revalidating' })
        try {
          await mutate()
        } finally {
          setCountdown({
            type: 'countdown',
            remainingSeconds: IP_REFRESH_SECONDS,
          })
        }
      }
    } else {
      setCountdown({
        type: 'countdown',
        remainingSeconds: remaining,
      })
    }
  })

  useEffect(() => {
    let timer: number | null = null

    if (hasIntersected) {
      console.debug(
        'IP info card has entered the viewport, starting the countdown interval.',
      )
      timer = window.setInterval(onCountdownTick, COUNTDOWN_TICK_INTERVAL)
    } else {
      console.debug(
        'IP info card has not yet entered the viewport, no counting down.',
      )
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    function onVisibilityChange() {
      if (document.hidden) {
        console.debug('Document hidden, pause the interval')
        if (timer != null) {
          clearInterval(timer)
          timer = null
        }
      } else if (hasIntersected) {
        console.debug('Document visible, resume the interval')
        if (timer == null) {
          timer = window.setInterval(onCountdownTick, COUNTDOWN_TICK_INTERVAL)
        }
      } else {
        console.debug(
          'Document visible, but IP info card has never entered the viewport, not even once, not starting the interval.',
        )
      }
    }

    return () => {
      if (timer != null) clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [hasIntersected])

  const toggleShowIp = useCallback(() => {
    setShowIp((prev) => !prev)
  }, [])

  let mainElement: React.ReactElement

  switch (true) {
    case isLoading:
      mainElement = (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-[70%]" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )
      break
    case !!error:
      mainElement = (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-destructive">
          <p className="text-sm">
            {error instanceof Error
              ? error.message
              : t('home.components.ipInfo.errors.load')}
          </p>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            {t('shared.actions.retry')}
          </Button>
        </div>
      )
      break
    default:
      mainElement = (
        <div className="flex h-full flex-col">
          <div className="flex flex-1 flex-row gap-2 overflow-hidden">
            <div className="w-2/5 overflow-hidden">
              <div className="mb-2 flex items-center gap-2 overflow-hidden">
                <span
                  className="inline-block w-7 shrink-0 text-center text-2xl"
                  style={{
                    fontFamily:
                      getSystem() === 'windows'
                        ? '"twemoji mozilla", sans-serif'
                        : 'sans-serif',
                  }}
                >
                  {getCountryFlag(ipInfo?.country_code)}
                </span>
                <span className="truncate text-sm font-medium">
                  {ipInfo?.country ||
                    t('home.components.ipInfo.labels.unknown')}
                </span>
              </div>

              <div className="mb-2 flex items-center">
                <span className="shrink-0 text-muted-foreground">
                  {t('home.components.ipInfo.labels.ip')}:
                </span>
                <div className="ml-2 flex max-w-[calc(100%-30px)] items-center overflow-hidden">
                  <span className="overflow-hidden font-mono text-ellipsis break-all">
                    {showIp ? ipInfo?.ip : '••••••••••'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={toggleShowIp}
                    aria-label={t('home.components.ipInfo.labels.ip')}
                  >
                    {showIp ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                </div>
              </div>

              <InfoItem
                label={t('home.components.ipInfo.labels.asn')}
                value={ipInfo?.asn ? `AS${ipInfo.asn}` : 'N/A'}
              />
            </div>

            <div className="w-3/5 overflow-auto">
              <InfoItem
                label={t('home.components.ipInfo.labels.isp')}
                value={ipInfo?.organization}
              />
              <InfoItem
                label={t('home.components.ipInfo.labels.org')}
                value={ipInfo?.asn_organization}
              />
              <InfoItem
                label={t('home.components.ipInfo.labels.location')}
                value={[ipInfo?.city, ipInfo?.region]
                  .filter(Boolean)
                  .join(', ')}
              />
              <InfoItem
                label={t('home.components.ipInfo.labels.timezone')}
                value={ipInfo?.timezone}
              />
            </div>
          </div>

          <Separator className="mt-auto" />
          <div className="flex items-center justify-between gap-2 pt-1.5 text-[0.625rem] text-muted-foreground">
            <span className="shrink-0">
              {t('home.components.ipInfo.labels.autoRefresh')}
              {countdown.type === 'countdown'
                ? `: ${countdown.remainingSeconds}s`
                : '...'}
            </span>
            <span className="truncate">
              {`${ipInfo?.country_code ?? 'N/A'}, ${ipInfo?.longitude?.toFixed(2) ?? 'N/A'}, ${ipInfo?.latitude?.toFixed(2) ?? 'N/A'}`}
            </span>
          </div>
        </div>
      )
  }

  return (
    <IPInfoCardContainer ref={containerRef}>{mainElement}</IPInfoCardContainer>
  )
}

function useIPInfo() {
  return useQuery({
    queryKey: [IP_INFO_CACHE_KEY],
    queryFn: getIpInfo,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
    retryDelay: 30_000,
  })
}
