import { useLockFn } from 'ahooks'
import dayjs from 'dayjs'
import { DatabaseIcon, RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateProxyProvider } from 'tauri-plugin-mihomo-api'

import { useAppRefreshers, useProxiesData } from '@/providers/app-data-context'
import { syncRuntimeProviders } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import parseTraffic from '@/utils/parse-traffic'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/components/ui/dialog'
import { Progress } from '@ui/components/ui/progress'
import { Separator } from '@ui/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

const parseExpire = (expire?: number) => {
  if (!expire) return '-'
  return dayjs(expire * 1000).format('YYYY-MM-DD')
}

export const ProviderButton = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { proxyView } = useProxiesData()
  const { refreshProxy } = useAppRefreshers()
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const providers = proxyView?.providers ?? []
  const providerUnavailable = proxyView?.providerState === 'unavailable'

  const updateProvider = useLockFn(async (name: string) => {
    try {
      setUpdating((prev) => ({ ...prev, [name]: true }))

      await mutate(() => updateProxyProvider(name), {
        id: `update-proxy-provider-${name}`,
        errorNotice: false,
      })

      await refreshProxy()
      void mutate(() => syncRuntimeProviders(), {
        id: 'sync-runtime-providers',
        errorNotice: false,
      })

      showNotice.success(
        'proxies.feedback.notifications.provider.updateSuccess',
        {
          name,
        },
      )
    } catch (err) {
      showNotice.error('proxies.feedback.notifications.provider.updateFailed', {
        name,
        message: String(err),
      })
    } finally {
      setUpdating((prev) => ({ ...prev, [name]: false }))
    }
  })

  const updateAllProviders = useLockFn(async () => {
    try {
      const allProviders = providers.map(({ name }) => name)
      if (allProviders.length === 0) {
        showNotice.info('proxies.feedback.notifications.provider.none')
        return
      }

      const newUpdating = allProviders.reduce(
        (acc, key) => {
          acc[key] = true
          return acc
        },
        {} as Record<string, boolean>,
      )
      setUpdating(newUpdating)

      for (const name of allProviders) {
        try {
          await mutate(() => updateProxyProvider(name), {
            id: `update-proxy-provider-${name}`,
            errorNotice: false,
          })
          setUpdating((prev) => ({ ...prev, [name]: false }))
        } catch (err) {
          console.error(`更新 ${name} 失败`, err)
        }
      }

      await refreshProxy()
      void mutate(() => syncRuntimeProviders(), {
        id: 'sync-runtime-providers',
        errorNotice: false,
      })

      showNotice.success('proxies.feedback.notifications.provider.allUpdated')
    } catch (err) {
      showNotice.error('proxies.feedback.notifications.provider.genericError', {
        message: String(err),
      })
    } finally {
      setUpdating({})
    }
  })

  const handleClose = () => {
    setOpen(false)
  }

  if (providers.length === 0 && !providerUnavailable) return null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        title={t('proxies.page.provider.title')}
        onClick={() => setOpen(true)}
        disabled={providerUnavailable}
        className={cn(
          providerUnavailable &&
            'border-warning text-warning disabled:opacity-100',
        )}
      >
        <DatabaseIcon data-icon="inline-start" />
        <span className="@max-2xl/page-header:hidden">
          {t('proxies.page.provider.title')}
        </span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleClose()
        }}
      >
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
          <DialogHeader className="flex-row items-center justify-between gap-2 pe-8">
            <DialogTitle>{t('proxies.page.provider.title')}</DialogTitle>
            <DialogDescription className="sr-only">
              {t('proxies.page.provider.title')}
            </DialogDescription>
            <Button
              size="sm"
              onClick={() => void updateAllProviders()}
              aria-label={t('proxies.page.provider.actions.updateAll')}
            >
              {t('proxies.page.provider.actions.updateAll')}
            </Button>
          </DialogHeader>

          <div className="-mx-4 min-h-62 flex-1 overflow-y-auto px-4">
            <div className="flex flex-col gap-2">
              {providers.map((provider) => {
                const key = provider.name
                const updatedAt = provider.updatedAt
                  ? dayjs(provider.updatedAt)
                  : null
                const isUpdating = updating[key]

                const sub = provider.subscriptionInfo
                const hasSubInfo = !!sub
                const upload = sub?.upload || 0
                const download = sub?.download || 0
                const total = sub?.total || 0
                const expire = sub?.expire || 0

                const progress =
                  total > 0
                    ? Math.min(
                        Math.round(((download + upload) * 100) / total) + 1,
                        100,
                      )
                    : 0

                return (
                  <div
                    key={key}
                    className="flex items-stretch overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div
                          title={key}
                          className="flex min-w-0 items-center gap-1.5"
                        >
                          <span className="truncate text-sm font-medium">
                            {key}
                          </span>
                          <Badge variant="secondary">
                            {provider.proxyRecordIds.length}
                          </Badge>
                          <Badge variant="outline">
                            {provider.vehicleType}
                          </Badge>
                        </div>

                        <span className="shrink-0 truncate text-xs text-muted-foreground">
                          <small>{t('shared.labels.updateAt')}: </small>
                          {updatedAt?.fromNow() ?? '-'}
                        </span>
                      </div>

                      {hasSubInfo && (
                        <>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span title={t('shared.labels.usedTotal')}>
                              {parseTraffic(upload + download)} /{' '}
                              {parseTraffic(total)}
                            </span>
                            <span title={t('shared.labels.expireTime')}>
                              {parseExpire(expire)}
                            </span>
                          </div>

                          <Progress
                            value={progress}
                            className={cn(
                              'h-1.5',
                              total > 0 ? '' : 'opacity-0',
                            )}
                          />
                        </>
                      )}
                    </div>
                    <Separator orientation="vertical" />
                    <div className="flex w-10 items-center justify-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              void updateProvider(key)
                            }}
                            disabled={isUpdating}
                            aria-label={t(
                              'proxies.page.provider.actions.update',
                            )}
                          >
                            <RefreshCwIcon
                              className={cn(isUpdating && 'animate-spin')}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('proxies.page.provider.actions.update')}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t('shared.actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
