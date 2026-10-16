import { TriangleAlertIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  continueWithSidecar,
  installService,
  reinstallService,
  repairService,
  restartCore,
  type ServiceInstallOutcome,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { useAppReads, useRunState } from '@/store/app-store-context'
import { BaseDialog } from '@ui/components/base'
import { Alert, AlertDescription } from '@ui/components/ui/alert'

export const ServiceMigrationDialog = () => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [stateRefreshFailed, setStateRefreshFailed] = useState(false)
  const [workflowIncomplete, setWorkflowIncomplete] = useState(false)
  const { readRunState } = useAppReads()
  const runState = useRunState()
  const needsDecision =
    stateRefreshFailed || Boolean(runState?.serviceNeedsAttention)
  const remedy: 'install' | 'repair' | 'reinstall' =
    runState?.pendingAction === 'install'
      ? 'install'
      : stateRefreshFailed || runState?.service === 'unavailable'
        ? 'repair'
        : runState?.service === 'notInstalled'
          ? 'install'
          : 'reinstall'
  const open = loading || workflowIncomplete || needsDecision
  const checking =
    loading ||
    !runState ||
    runState.opInFlight ||
    runState.service === 'unknown'
  const showCheckingMessage = checking || !needsDecision
  const canContinue = Boolean(
    runState &&
      !stateRefreshFailed &&
      (runState.pendingAction === 'install'
        ? runState.mode === 'NotRunning' || runState.mode === 'Sidecar'
        : !runState.pendingAction &&
          !runState.sidecarAllowed &&
          runState.mode === 'NotRunning' &&
          (runState.service === 'notInstalled' ||
            runState.service === 'versionMismatch' ||
            runState.service === 'unavailable')),
  )

  const refreshRunState = async () => {
    try {
      const data = await readRunState()
      setStateRefreshFailed(false)
      return data
    } catch (error) {
      setStateRefreshFailed(true)
      throw error
    }
  }

  const handleServiceAction = async () => {
    setLoading(true)
    setWorkflowIncomplete(true)
    let outcome: ServiceInstallOutcome | undefined
    try {
      if (remedy === 'install') {
        const result = await mutate(() => installService(), {
          id: 'install-service',
          errorNotice: false,
        })
        if (result.ok) outcome = result.value
      } else if (remedy === 'repair') {
        const result = await mutate(() => repairService(), {
          id: 'repair-service',
          errorNotice: false,
        })
        if (result.ok) outcome = result.value
      } else {
        const result = await mutate(() => reinstallService(), {
          id: 'reinstall-service',
          errorNotice: false,
        })
        if (result.ok) outcome = result.value
      }
    } catch (error) {
      showNotice.error(
        'layout.components.serviceMigration.errors.actionFailed',
        error,
      )
    }

    let initialRefreshSucceeded = false
    try {
      await refreshRunState()
      initialRefreshSucceeded = true
    } catch (error) {
      showNotice.error(
        'layout.components.serviceMigration.errors.stateRefreshFailed',
        error,
      )
    }
    if (!outcome || !initialRefreshSucceeded) {
      setLoading(false)
      return
    }
    if (outcome.status === 'sidecar') {
      setWorkflowIncomplete(false)
      setLoading(false)
      showNotice.warning(
        'settings.feedback.notifications.clashService.permissionFallback',
        { reason: outcome.reason },
        0,
      )
      return
    }

    let restartSucceeded = false
    try {
      const result = await mutate(() => restartCore(), {
        id: 'restart-core',
        errorNotice: false,
      })
      restartSucceeded = result.ok
    } catch (error) {
      showNotice.error(
        'layout.components.serviceMigration.errors.restartFailed',
        error,
      )
    }

    let finalRefreshSucceeded = false
    try {
      await refreshRunState()
      finalRefreshSucceeded = true
    } catch (error) {
      showNotice.error(
        'layout.components.serviceMigration.errors.stateRefreshFailed',
        error,
      )
    }
    if (restartSucceeded && finalRefreshSucceeded) {
      setWorkflowIncomplete(false)
      showNotice.success('layout.components.serviceMigration.success')
    }
    setLoading(false)
  }

  const handleContinue = async () => {
    setLoading(true)
    setWorkflowIncomplete(true)
    let startupError: unknown
    try {
      await mutate(() => continueWithSidecar(), {
        id: 'continue-with-sidecar',
        errorNotice: false,
      })
    } catch (error) {
      startupError = error
    }

    let installRefreshSucceeded = false
    try {
      await refreshRunState()
      installRefreshSucceeded = true
    } catch (error) {
      showNotice.error(
        'layout.components.serviceMigration.errors.stateRefreshFailed',
        error,
      )
    }
    if (startupError) {
      showNotice.error(
        'layout.components.serviceMigration.errors.sidecarFailed',
        startupError,
      )
    } else if (installRefreshSucceeded) {
      setWorkflowIncomplete(false)
    }
    setLoading(false)
  }

  return (
    <BaseDialog
      open={open}
      title={t('layout.components.serviceMigration.title')}
      okBtn={t(
        remedy === 'install'
          ? 'settings.sections.proxyControl.actions.installService'
          : remedy === 'repair'
            ? 'layout.components.serviceMigration.repair'
            : 'layout.components.serviceMigration.reinstall',
      )}
      cancelBtn={t('layout.components.serviceMigration.continueSidecar')}
      disableOk={checking}
      disableCancel={checking || !canContinue}
      loading={loading}
      onOk={() => void handleServiceAction()}
      onCancel={() => void handleContinue()}
    >
      <Alert>
        <TriangleAlertIcon className="text-warning" />
        <AlertDescription>
          {t(
            showCheckingMessage
              ? 'layout.components.serviceMigration.checkingMessage'
              : remedy === 'reinstall'
                ? 'layout.components.serviceMigration.message'
                : 'layout.components.serviceMigration.unavailableMessage',
          )}
        </AlertDescription>
      </Alert>
    </BaseDialog>
  )
}
