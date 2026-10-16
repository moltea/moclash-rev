import { useLockFn } from 'ahooks'
import { TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import type { ProxyEmptyStateReason } from '@/components/proxy/proxy-empty-state-model'
import { useSystemState } from '@/hooks/use-system-state'
import { useAppRefreshers } from '@/providers/app-data-context'
import { openLogsDir, restartCore } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { Alert, AlertDescription, AlertTitle } from '@ui/components/ui/alert'
import { Button } from '@ui/components/ui/button'
import { Spinner } from '@ui/components/ui/spinner'

interface Props {
  reason: ProxyEmptyStateReason
}

export const ProxyEmptyState = ({ reason }: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refreshProxy } = useAppRefreshers()
  const { mutateSystemState } = useSystemState()
  const [isRestarting, setIsRestarting] = useState(false)

  const handleRestart = useLockFn(async () => {
    setIsRestarting(true)
    try {
      await mutate(() => restartCore(), { id: 'restart-core' })
      await Promise.all([refreshProxy(), mutateSystemState()])
    } catch {
    } finally {
      setIsRestarting(false)
    }
  })

  const title =
    reason === 'no-subscriptions'
      ? t('proxies.page.empty.noSubscriptions.title')
      : reason === 'inactive-subscription'
        ? t('proxies.page.empty.inactiveSubscription.title')
        : reason === 'core-unavailable'
          ? t('proxies.page.empty.coreUnavailable.title')
          : t('proxies.page.empty.noProxyInfo.title')
  const description =
    reason === 'no-subscriptions'
      ? t('proxies.page.empty.noSubscriptions.description')
      : reason === 'inactive-subscription'
        ? t('proxies.page.empty.inactiveSubscription.description')
        : reason === 'core-unavailable'
          ? t('proxies.page.empty.coreUnavailable.description')
          : t('proxies.page.empty.noProxyInfo.description')
  const showProfiles =
    reason === 'no-subscriptions' ||
    reason === 'inactive-subscription' ||
    reason === 'no-proxy-info'
  const showCoreActions =
    reason === 'core-unavailable' || reason === 'no-proxy-info'

  return (
    <div className="flex size-full items-center justify-center p-4">
      <Alert className="w-full max-w-160 border-warning/50">
        <TriangleAlertIcon className="text-warning" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>{description}</span>
          <div className="flex flex-wrap gap-2">
            {showProfiles && (
              <Button size="sm" onClick={() => navigate('/profile')}>
                {t('proxies.page.empty.actions.openProfiles')}
              </Button>
            )}

            {showCoreActions && (
              <>
                <Button
                  size="sm"
                  disabled={isRestarting}
                  onClick={() => void handleRestart()}
                >
                  {isRestarting && <Spinner data-icon="inline-start" />}
                  {t('proxies.page.empty.actions.restartCore')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRestarting}
                  onClick={() => void openLogsDir()}
                >
                  {t('proxies.page.empty.actions.openLogs')}
                </Button>
              </>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
