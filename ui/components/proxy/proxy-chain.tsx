import { arrayMove } from '@dnd-kit/helpers'
import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import * as yaml from 'js-yaml'
import {
  ArrowDownIcon,
  GripVerticalIcon,
  InfoIcon,
  LinkIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UnlinkIcon,
} from 'lucide-react'
import {
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  closeAllConnections,
  selectNodeForGroup,
} from 'tauri-plugin-mihomo-api'

import {
  rebindProxyChainItems,
  type ProxyChainItem,
} from '@/components/proxy/proxy-chain-model'
import { useRuntimeConfig } from '@/hooks/use-clash'
import { useRecordSelection } from '@/hooks/use-record-selection'
import { useAppRefreshers, useProxiesData } from '@/providers/app-data-context'
import { updateProxyChainConfigInRuntime } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import {
  selectGlobalChainNodes,
  selectRuleChainMembers,
} from '@/types/proxy-view'
import { debugLog } from '@/utils/debug'
import { TooltipIcon } from '@ui/components/base'
import { Alert, AlertDescription } from '@ui/components/ui/alert'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import { Empty, EmptyHeader, EmptyTitle } from '@ui/components/ui/empty'
import { Spinner } from '@ui/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

const chainPointerSensor = PointerSensor.configure({
  activationConstraints: () => undefined,
})

type RuntimeConfigWithProxySequence = IConfigData & { proxies?: unknown }

interface ParsedChainConfig {
  proxies?: Array<{
    name: string
    type: string
    [key: string]: any
  }>
}

interface ProxyChainProps {
  proxyChain: ProxyChainItem[]
  onUpdateChain: (chain: ProxyChainItem[]) => void
  chainConfigData?: string | null
  onMarkUnsavedChanges?: () => void
  mode?: string
  selectedGroup?: string | null
}

interface ProxyChainItemProps {
  id: string
  proxy: ProxyChainItem
  index: number
  isFirst: boolean
  isLast: boolean
  onRemove: (id: string) => void
}

const toChainItems = (
  parsedConfig: ParsedChainConfig | null | undefined,
): ProxyChainItem[] => {
  const timestamp = Date.now()

  return (
    parsedConfig?.proxies?.map((proxy, index) => ({
      id: `${proxy.name}_${timestamp}_${index}`,
      name: proxy.name,
      type: proxy.type,
      delay: undefined,
    })) || []
  )
}

interface ChainCardProps {
  proxy: ProxyChainItem
  index: number
  isFirst: boolean
  isLast: boolean
  isDragging?: boolean
  isDropping?: boolean
  handleRef?: Ref<HTMLDivElement> | null
  onRemove?: (id: string) => void
}

const ChainCard = ({
  proxy,
  index,
  isFirst,
  isLast,
  isDragging,
  isDropping,
  handleRef,
  onRemove,
}: ChainCardProps) => {
  const { t } = useTranslation()

  const roleLabel = isFirst
    ? t('proxies.page.chain.entryNode')
    : isLast
      ? t('proxies.page.chain.exitNode')
      : undefined

  const delayClass =
    proxy.delay !== undefined && proxy.delay > 0 && proxy.delay < 200
      ? 'bg-success/10 text-success'
      : proxy.delay !== undefined && proxy.delay > 0 && proxy.delay < 800
        ? 'bg-warning/10 text-warning'
        : 'bg-destructive/10 text-destructive'

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border bg-background p-1.5 transition-[box-shadow,background-color]',
        isFirst && 'border-success',
        isLast && 'border-warning',
        proxy.recordId === undefined && 'opacity-55',
        isDropping && 'ring-2 ring-primary/40',
      )}
    >
      <div
        ref={handleRef}
        className={cn(
          'flex items-center text-muted-foreground',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
      >
        <GripVerticalIcon className="size-4" />
      </div>

      {roleLabel ? (
        <Badge
          className={cn(
            'font-semibold',
            isFirst
              ? 'bg-success/10 text-success'
              : 'bg-warning/10 text-warning',
          )}
        >
          {roleLabel}
        </Badge>
      ) : (
        <Badge className="min-w-8">{`${index + 1}`}</Badge>
      )}

      <span className="min-w-0 flex-1 truncate text-xs font-medium">
        {proxy.name}
      </span>

      {proxy.type && <Badge variant="outline">{proxy.type}</Badge>}

      {proxy.delay !== undefined && (
        <Badge className={cn('min-w-12 tabular-nums', delayClass)}>
          {proxy.delay > 0 ? `${proxy.delay}ms` : t('shared.labels.timeout')}
        </Badge>
      )}

      {onRemove && (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(proxy.id)}
        >
          <Trash2Icon />
        </Button>
      )}
    </div>
  )
}

const SortableProxyChainItem = ({
  id,
  proxy,
  index,
  isFirst,
  isLast,
  onRemove,
}: ProxyChainItemProps) => {
  const [element, setElement] = useState<Element | null>(null)
  const handleRef = useRef<HTMLDivElement | null>(null)
  const { isDragging, isDropping } = useSortable({
    id,
    index,
    element,
    handle: handleRef,
  })

  return (
    <div
      ref={setElement}
      className="group/chain-item w-full data-dnd-dragging:h-auto data-dnd-dragging:shadow-none!"
    >
      <ChainCard
        proxy={proxy}
        index={index}
        isFirst={isFirst}
        isLast={isLast}
        isDragging={isDragging}
        isDropping={isDropping}
        handleRef={handleRef}
        onRemove={onRemove}
      />
      {!isLast && (
        <div className="flex justify-center py-0.5 duration-250 animate-in fade-in-0 slide-in-from-bottom-1 group-data-dnd-dragging/chain-item:hidden">
          <ArrowDownIcon className="size-4 text-primary opacity-70" />
        </div>
      )}
    </div>
  )
}

export const ProxyChain = ({
  proxyChain,
  onUpdateChain,
  chainConfigData,
  onMarkUnsavedChanges,
  mode,
  selectedGroup,
}: ProxyChainProps) => {
  const { t } = useTranslation()
  const chainWarning = t('proxies.page.chain.warning')
  const { proxyView } = useProxiesData()
  const { refreshProxy } = useAppRefreshers()
  const { data: runtimeConfig } = useRuntimeConfig(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const recordSelection = useRecordSelection()
  const markUnsavedChanges = useCallback(() => {
    onMarkUnsavedChanges?.()
  }, [onMarkUnsavedChanges])

  const candidates = useMemo(() => {
    if (!proxyView) return []
    if (mode === 'rule' && selectedGroup) {
      return selectRuleChainMembers(proxyView, selectedGroup).flatMap(
        ({ member }) => (member.kind === 'node' ? [member.node] : []),
      )
    }
    if (!runtimeConfig) return []
    const runtimeProxies = (
      runtimeConfig as RuntimeConfigWithProxySequence | null
    )?.proxies
    return selectGlobalChainNodes(proxyView, runtimeProxies)
  }, [mode, proxyView, runtimeConfig, selectedGroup])

  const currentProxyChain = useMemo(
    () =>
      proxyView
        ? rebindProxyChainItems(proxyChain, candidates, proxyView)
        : proxyChain.map((item) => ({
            ...item,
            recordId: undefined,
            delay: undefined,
          })),
    [candidates, proxyChain, proxyView],
  )

  const isConnected = useMemo(() => {
    if (!proxyView || currentProxyChain.length === 0) {
      return false
    }

    const lastNode = currentProxyChain[currentProxyChain.length - 1]
    if (localStorage.getItem('proxy-chain-exit-node') === lastNode.name) {
      return true
    }
    if (currentProxyChain.length < 2) return false

    if (mode === 'global') {
      return proxyView.global?.now === lastNode.name
    }

    if (!selectedGroup) {
      return false
    }

    const proxyChainGroup = proxyView.groups.find(
      (group) => group.name === selectedGroup,
    )

    return proxyChainGroup?.now === lastNode.name
  }, [proxyView, currentProxyChain, mode, selectedGroup])

  const chainLengthRef = useRef(currentProxyChain.length)
  useEffect(() => {
    if (
      chainLengthRef.current !== currentProxyChain.length &&
      chainLengthRef.current !== 0
    ) {
      markUnsavedChanges()
    }
    chainLengthRef.current = currentProxyChain.length
  }, [currentProxyChain.length, markUnsavedChanges])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { operation, canceled } = event
      const { source, target } = operation
      if (canceled || !target || !isSortable(source)) return

      const { index: newIndex, initialIndex: oldIndex } = source.sortable
      if (
        oldIndex < 0 ||
        newIndex < 0 ||
        oldIndex >= currentProxyChain.length ||
        newIndex >= currentProxyChain.length ||
        oldIndex === newIndex
      ) {
        return
      }

      onUpdateChain(arrayMove(currentProxyChain, oldIndex, newIndex))
      markUnsavedChanges()
    },
    [currentProxyChain, onUpdateChain, markUnsavedChanges],
  )

  const handleRemoveProxy = useCallback(
    (id: string) => {
      const newChain = currentProxyChain.filter((item) => item.id !== id)
      onUpdateChain(newChain)
      markUnsavedChanges()
    },
    [currentProxyChain, onUpdateChain, markUnsavedChanges],
  )

  const handleConnect = useCallback(async () => {
    if (isConnected) {
      setIsConnecting(true)
      try {
        const result = await mutate(
          () => updateProxyChainConfigInRuntime(null),
          {
            id: 'update-proxy-chain-runtime',
            errorNotice: false,
          },
        )
        if (!result.ok) return

        const targetGroup =
          mode === 'global'
            ? 'GLOBAL'
            : selectedGroup || localStorage.getItem('proxy-chain-group')

        if (targetGroup) {
          try {
            await mutate(() => selectNodeForGroup(targetGroup, 'DIRECT'), {
              id: `select-proxy-node:${targetGroup}`,
              errorNotice: false,
            })
            await recordSelection(targetGroup, 'DIRECT')
          } catch {
            if (currentProxyChain.length >= 1) {
              try {
                await mutate(
                  () =>
                    selectNodeForGroup(targetGroup, currentProxyChain[0].name),
                  {
                    id: `select-proxy-node:${targetGroup}`,
                    errorNotice: false,
                  },
                )
                await recordSelection(targetGroup, currentProxyChain[0].name)
              } catch {}
            }
          }
        }

        localStorage.removeItem('proxy-chain-group')
        localStorage.removeItem('proxy-chain-exit-node')
        localStorage.removeItem('proxy-chain-items')

        await mutate(() => closeAllConnections(), {
          id: 'close-all-connections',
          errorNotice: false,
        })
        await refreshProxy()

        onUpdateChain([])
      } catch (error) {
        console.error('Failed to disconnect from proxy chain:', error)
        alert(t('proxies.page.chain.disconnectFailed'))
      } finally {
        setIsConnecting(false)
      }
      return
    }

    if (mode === 'global' && proxyView?.global === null) {
      alert(t('proxies.page.chain.connectFailed'))
      return
    }

    if (
      currentProxyChain.length < 2 ||
      currentProxyChain.some(({ recordId }) => !recordId)
    ) {
      alert(t('proxies.page.chain.minimumNodes'))
      return
    }

    setIsConnecting(true)
    try {
      const chainProxies = currentProxyChain.map((node) => node.name)
      debugLog('Saving chain config:', chainProxies)
      const result = await mutate(
        () => updateProxyChainConfigInRuntime(chainProxies),
        {
          id: 'update-proxy-chain-runtime',
          errorNotice: false,
        },
      )
      if (!result.ok) return
      debugLog('Chain configuration saved successfully')

      const lastNode = currentProxyChain[currentProxyChain.length - 1]
      debugLog(`Connecting to proxy chain, last node: ${lastNode.name}`)

      if (mode !== 'global' && !selectedGroup) {
        throw new Error('规则模式下必须选择代理组')
      }

      const targetGroup = mode === 'global' ? 'GLOBAL' : selectedGroup

      await mutate(
        () => selectNodeForGroup(targetGroup || 'GLOBAL', lastNode.name),
        {
          id: `select-proxy-node:${targetGroup || 'GLOBAL'}`,
          errorNotice: false,
        },
      )
      await recordSelection(targetGroup || 'GLOBAL', lastNode.name)
      localStorage.setItem('proxy-chain-group', targetGroup || 'GLOBAL')
      localStorage.setItem('proxy-chain-exit-node', lastNode.name)

      await refreshProxy()
      debugLog('Successfully connected to proxy chain')
    } catch (error) {
      console.error('Failed to connect to proxy chain:', error)
      alert(t('proxies.page.chain.connectFailed'))
    } finally {
      setIsConnecting(false)
    }
  }, [
    currentProxyChain,
    isConnected,
    t,
    refreshProxy,
    mode,
    proxyView,
    selectedGroup,
    onUpdateChain,
    recordSelection,
  ])

  useEffect(() => {
    if (chainConfigData) {
      try {
        const parsedConfig = yaml.load(chainConfigData) as ParsedChainConfig
        const chainItems = toChainItems(parsedConfig)

        if (chainItems.length > 0) {
          onUpdateChain(chainItems)
        }
      } catch (error) {
        console.error('Failed to process chain config data:', error)
      }
    }
  }, [chainConfigData, onUpdateChain])

  const connectDisabled =
    isConnecting ||
    (!isConnected &&
      (currentProxyChain.length < 2 ||
        currentProxyChain.some(({ recordId }) => recordId === undefined) ||
        (mode === 'global' && proxyView?.global === null) ||
        (mode !== 'global' && !selectedGroup)))
  const connectTitle =
    !isConnected && currentProxyChain.length < 2
      ? t('proxies.page.chain.minimumNodes')
      : undefined

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="truncate font-heading text-sm font-semibold">
            {t('proxies.page.chain.header')}
          </h2>
          <TooltipIcon
            title={chainWarning}
            icon={TriangleAlertIcon}
            className="text-warning"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {currentProxyChain.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t('proxies.page.actions.clearChainConfig')}
                  onClick={() => {
                    void mutate(() => updateProxyChainConfigInRuntime(null), {
                      id: 'update-proxy-chain-runtime',
                      onFulfilled: () => {
                        localStorage.removeItem('proxy-chain-group')
                        localStorage.removeItem('proxy-chain-exit-node')
                        localStorage.removeItem('proxy-chain-items')
                        onUpdateChain([])
                      },
                    }).catch(() => {})
                  }}
                >
                  <Trash2Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('proxies.page.actions.clearChainConfig')}
              </TooltipContent>
            </Tooltip>
          )}
          <span title={connectTitle} className="inline-flex">
            <Button
              size="sm"
              variant={isConnected ? 'destructive' : 'default'}
              className="min-w-22"
              disabled={connectDisabled}
              onClick={() => {
                handleConnect().catch(() => {})
              }}
            >
              {isConnecting ? (
                <Spinner data-icon="inline-start" />
              ) : isConnected ? (
                <UnlinkIcon data-icon="inline-start" />
              ) : (
                <LinkIcon data-icon="inline-start" />
              )}
              {isConnecting
                ? t('proxies.page.actions.connecting')
                : isConnected
                  ? t('proxies.page.actions.disconnect')
                  : t('proxies.page.actions.connect')}
            </Button>
          </span>
        </div>
      </div>

      <Alert
        className={cn(currentProxyChain.length === 1 && 'border-warning/50')}
      >
        {currentProxyChain.length === 1 ? (
          <TriangleAlertIcon className="text-warning" />
        ) : (
          <InfoIcon className="text-info" />
        )}
        <AlertDescription>
          {currentProxyChain.length === 1
            ? t('proxies.page.chain.minimumNodesHint')
            : t('proxies.page.chain.instruction')}
        </AlertDescription>
      </Alert>

      <div className="min-h-0 flex-1 overflow-auto">
        {currentProxyChain.length === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyTitle className="text-muted-foreground">
                {t('proxies.page.chain.empty')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <DragDropProvider
            sensors={[chainPointerSensor, KeyboardSensor]}
            onDragEnd={handleDragEnd}
          >
            <div className="min-h-15 p-1">
              {currentProxyChain.map((proxy, index) => (
                <SortableProxyChainItem
                  key={proxy.id}
                  id={proxy.id}
                  proxy={proxy}
                  index={index}
                  isFirst={index === 0}
                  isLast={
                    index === currentProxyChain.length - 1 &&
                    currentProxyChain.length > 1
                  }
                  onRemove={handleRemoveProxy}
                />
              ))}
            </div>
          </DragDropProvider>
        )}
      </div>
    </div>
  )
}
