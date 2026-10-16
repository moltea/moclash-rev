import { useLockFn } from 'ahooks'
import dayjs from 'dayjs'
import { DatabaseIcon, RefreshCwIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { updateRuleProvider } from 'tauri-plugin-mihomo-api'

import { useAppRefreshers, useRulesData } from '@/providers/app-data-context'
import { syncRuntimeProviders } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { BaseDialog } from '@ui/components/base'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import { Separator } from '@ui/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

export const ProviderButton = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { ruleProviders } = useRulesData()
  const { refreshRules, refreshRuleProviders } = useAppRefreshers()
  const [updating, setUpdating] = useState<Record<string, boolean>>({})

  const hasProviders = Object.keys(ruleProviders || {}).length > 0

  const updateProvider = useLockFn(async (name: string) => {
    try {
      setUpdating((prev) => ({ ...prev, [name]: true }))

      await mutate(() => updateRuleProvider(name), {
        id: `update-rule-provider-${name}`,
        errorNotice: false,
      })

      await refreshRules()
      await refreshRuleProviders()
      void mutate(() => syncRuntimeProviders(), {
        id: 'sync-runtime-providers',
        errorNotice: false,
      })

      showNotice.success(
        'rules.feedback.notifications.provider.updateSuccess',
        {
          name,
        },
      )
    } catch (err) {
      showNotice.error('rules.feedback.notifications.provider.updateFailed', {
        name,
        message: String(err),
      })
    } finally {
      setUpdating((prev) => ({ ...prev, [name]: false }))
    }
  })

  const updateAllProviders = useLockFn(async () => {
    try {
      const allProviders = Object.keys(ruleProviders || {})
      if (allProviders.length === 0) {
        showNotice.info('rules.feedback.notifications.provider.none')
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
          await mutate(() => updateRuleProvider(name), {
            id: `update-rule-provider-${name}`,
            errorNotice: false,
          })
          setUpdating((prev) => ({ ...prev, [name]: false }))
        } catch (err) {
          console.error(`Failed to update ${name}`, err)
        }
      }

      await refreshRules()
      await refreshRuleProviders()
      void mutate(() => syncRuntimeProviders(), {
        id: 'sync-runtime-providers',
        errorNotice: false,
      })

      showNotice.success('rules.feedback.notifications.provider.allUpdated')
    } catch (err) {
      showNotice.error('rules.feedback.notifications.provider.genericError', {
        message: String(err),
      })
    } finally {
      setUpdating({})
    }
  })

  const handleClose = () => {
    setOpen(false)
  }

  if (!hasProviders) return null

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <DatabaseIcon data-icon="inline-start" />
        {t('rules.page.provider.trigger')}
      </Button>

      <BaseDialog
        open={open}
        title={t('rules.page.provider.dialogTitle')}
        className="sm:max-w-xl"
        okBtn={
          <>
            <RefreshCwIcon data-icon="inline-start" />
            {t('rules.page.provider.actions.updateAll')}
          </>
        }
        cancelBtn={t('shared.actions.close')}
        onOk={updateAllProviders}
        onCancel={handleClose}
        onClose={handleClose}
      >
        <div className="flex min-h-[250px] flex-col gap-2 py-1">
          {Object.entries(ruleProviders || {})
            .sort()
            .map(([key, item]) => {
              const provider = item
              const time = dayjs(provider.updatedAt)
              const isUpdating = updating[key]

              return (
                <div
                  key={key}
                  className="flex items-stretch overflow-hidden rounded-lg border bg-card transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className="flex min-w-0 items-center gap-2"
                        title={key}
                      >
                        <span className="truncate text-sm font-medium">
                          {key}
                        </span>
                        <Badge variant="secondary" className="tabular-nums">
                          {provider.ruleCount}
                        </Badge>
                      </div>

                      <span className="shrink-0 truncate text-muted-foreground">
                        <small>{t('shared.labels.updateAt')}: </small>
                        {time.fromNow()}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="outline">
                        {typeof provider.vehicleType === 'string'
                          ? provider.vehicleType
                          : provider.vehicleType.Unknown}
                      </Badge>
                      <Badge variant="outline">
                        {typeof provider.behavior === 'string'
                          ? provider.behavior
                          : provider.behavior.Unknown}
                      </Badge>
                    </div>
                  </div>
                  <Separator orientation="vertical" />
                  <div className="flex w-10 items-center justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => updateProvider(key)}
                            disabled={isUpdating}
                            aria-label={t('rules.page.provider.actions.update')}
                          >
                            <RefreshCwIcon
                              className={cn(isUpdating && 'animate-spin')}
                            />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('rules.page.provider.actions.update')}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )
            })}
        </div>
      </BaseDialog>
    </>
  )
}
