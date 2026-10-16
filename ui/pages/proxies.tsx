import { useLockFn } from 'ahooks'
import { NetworkIcon, TriangleAlertIcon } from 'lucide-react'
import { useCallback, useEffect, useReducer, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  useAppRefreshers,
  useClashConfigData,
} from '@/providers/app-data-context'
import {
  getRuntimeProxyChainConfig,
  patchClashMode,
  updateProxyChainConfigInRuntime,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { debugLog } from '@/utils/debug'
import { BasePage, TooltipIcon } from '@ui/components/base'
import { ProviderButton } from '@ui/components/proxy/provider-button'
import { ProxyGroups } from '@ui/components/proxy/proxy-groups'
import { Button } from '@ui/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@ui/components/ui/toggle-group'

const MODES = ['rule', 'global', 'direct'] as const
type Mode = (typeof MODES)[number]
const MODE_SET = new Set<string>(MODES)
const isMode = (value: unknown): value is Mode =>
  typeof value === 'string' && MODE_SET.has(value)

const ProxyPage = () => {
  const { t } = useTranslation()

  const [isChainMode, setIsChainMode] = useState(() => {
    try {
      const saved = localStorage.getItem('proxy-chain-mode-enabled')
      return saved === 'true'
    } catch {
      return false
    }
  })

  const [chainConfigData, dispatchChainConfigData] = useReducer(
    (_: string | null, action: string | null) => action,
    null as string | null,
  )

  const { clashConfig } = useClashConfigData()
  const { refreshClashConfig } = useAppRefreshers()

  const updateChainConfigData = useCallback((value: string | null) => {
    dispatchChainConfigData(value)
  }, [])

  const normalizedMode = clashConfig?.mode?.toLowerCase()
  const curMode = isMode(normalizedMode) ? normalizedMode : undefined
  const chainWarning = t('proxies.page.chain.warning')

  const onChangeMode = useLockFn(async (mode: Mode) => {
    try {
      await mutate(() => patchClashMode(mode), {
        id: 'patch-clash-mode',
        errorNotice: false,
      })
      await refreshClashConfig()
    } catch (error) {
      showNotice.error(error)
    }
  })

  const onToggleChainMode = useLockFn(async () => {
    const newChainMode = !isChainMode

    if (!newChainMode) {
      try {
        debugLog('Exiting chain mode, clearing chain configuration')
        const result = await mutate(
          () => updateProxyChainConfigInRuntime(null),
          {
            id: 'update-proxy-chain-runtime',
            errorNotice: false,
          },
        )
        if (!result.ok) return
        debugLog('Chain configuration cleared successfully')
      } catch (error) {
        console.error('Failed to clear chain configuration:', error)
        showNotice.error(error)
        return
      }
    }
    setIsChainMode(newChainMode)
    localStorage.setItem('proxy-chain-mode-enabled', newChainMode.toString())
  })

  useEffect(() => {
    if (!isChainMode) {
      updateChainConfigData(null)
      return
    }

    let cancelled = false

    const fetchChainConfig = async () => {
      try {
        const exitNode = localStorage.getItem('proxy-chain-exit-node')

        if (!exitNode) {
          console.error('No proxy chain exit node found in localStorage')
          if (!cancelled) {
            updateChainConfigData('')
          }
          return
        }

        const configData = await getRuntimeProxyChainConfig(exitNode)
        if (!cancelled) {
          updateChainConfigData(configData || '')
        }
      } catch (error) {
        console.error('Failed to get runtime proxy chain config:', error)
        if (!cancelled) {
          updateChainConfigData('')
        }
      }
    }

    fetchChainConfig().catch(() => {})

    return () => {
      cancelled = true
    }
  }, [isChainMode, updateChainConfigData])

  useEffect(() => {
    if (normalizedMode && !isMode(normalizedMode)) {
      onChangeMode('rule').catch(() => {})
    }
  }, [normalizedMode, onChangeMode])

  return (
    <BasePage
      full
      title={
        isChainMode ? (
          <span
            data-tauri-drag-region="true"
            className="inline-flex items-center gap-1"
          >
            {t('proxies.page.title.chainMode')}
            <TooltipIcon
              title={chainWarning}
              icon={TriangleAlertIcon}
              className="text-warning"
            />
          </span>
        ) : (
          t('proxies.page.title.default')
        )
      }
      header={
        <div className="flex items-center gap-2">
          <ProviderButton />

          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={curMode ?? ''}
          >
            {MODES.map((mode) => (
              <ToggleGroupItem
                key={mode}
                value={mode}
                className="capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                onClick={() => {
                  onChangeMode(mode).catch(() => {})
                }}
              >
                {t(`proxies.page.modes.${mode}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Button
            size="sm"
            variant={isChainMode ? 'default' : 'outline'}
            title={t('proxies.page.actions.toggleChain')}
            onClick={() => {
              onToggleChainMode().catch(() => {})
            }}
          >
            <NetworkIcon data-icon="inline-start" />
            <span className="@max-2xl/page-header:hidden">
              {t('proxies.page.actions.toggleChain')}
            </span>
          </Button>
        </div>
      }
    >
      <ProxyGroups
        mode={curMode ?? 'rule'}
        isChainMode={isChainMode}
        chainConfigData={chainConfigData}
      />
    </BasePage>
  )
}

export default ProxyPage
