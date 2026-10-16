import { DragDropProvider } from '@dnd-kit/react'
import {
  CheckIcon,
  ChevronDownIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react'
import {
  type Key,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import {
  type ProxyChainItem,
  rebindProxyChainItems,
} from '@/components/proxy/proxy-chain-model'
import type { HeadState } from '@/components/proxy/use-head-state'
import {
  PROXY_GROUP_HEADER_SENSORS,
  useProxyGroupHeaderLayout,
} from '@/components/proxy/use-proxy-group-header-layout'
import type { IRenderItem } from '@/components/proxy/use-render-list'
import { useProxiesData } from '@/providers/app-data-context'
import { updateProxyChainConfigInRuntime } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import {
  isInteractableMember,
  type ProxyGroupView,
  type ResolvedProxyMember,
} from '@/types/proxy-view'
import { ScrollTopButton } from '@ui/components/layout/scroll-top-button'
import { Alert, AlertAction, AlertDescription } from '@ui/components/ui/alert'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/ui/dropdown-menu'
import { cn } from '@ui/lib/utils'

import { ProxyChain } from './proxy-chain'
import { ProxyRender } from './proxy-render'

type VirtualListItem = {
  key: Key
  index: number
  start: number
  end: number
}

type ProxyGroupOption = ProxyGroupView

interface ChainRuleHeaderProps {
  title: string
  currentGroup: ProxyGroupOption | null
  canSelectGroup: boolean
  groupMenu: ReactNode
}

interface GroupSelectMenuProps {
  open: boolean
  selectLabel: string
  groups: ProxyGroupOption[]
  selectedGroup: string | null
  emptyText: string
  nodeCountLabel: (count: number) => string
  onOpenChange: (open: boolean) => void
  onSelect: (groupName: string) => void
}

interface ProxyGroupsChainProps {
  mode: string
  chainConfigData?: string | null
  availableGroups: any[]
  activeSelectedGroup: string | null
  showScrollTop: boolean

  parentRef: RefObject<HTMLDivElement | null>
  totalSize: number
  virtualItems: VirtualListItem[]
  renderList: IRenderItem[]
  activeStickyIndex: number | null
  measureElement: (node: Element | null) => void

  onCheckAll: (groupName: string) => void
  onHeadState: (groupName: string, patch: Partial<HeadState>) => void
  onLocation: (group: any) => void
  onGroupSelect: (groupName: string) => void
  onScrollToTop: () => void
}

function ChainRuleHeader({
  title,
  currentGroup,
  canSelectGroup,
  groupMenu,
}: ChainRuleHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="shrink-0 font-heading text-sm font-semibold">{title}</h2>

        {currentGroup && (
          <Badge variant="outline" className="max-w-50 justify-start">
            <span className="truncate">
              {`${currentGroup.name} (${currentGroup.type})`}
            </span>
          </Badge>
        )}
      </div>

      {canSelectGroup && groupMenu}
    </div>
  )
}

function GroupSelectMenu({
  open,
  selectLabel,
  groups,
  selectedGroup,
  emptyText,
  nodeCountLabel,
  onOpenChange,
  onSelect,
}: GroupSelectMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {selectLabel}
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-75 min-w-50">
        {groups.map((group) => (
          <DropdownMenuItem
            key={group.name}
            className={cn(selectedGroup === group.name && 'bg-accent/50')}
            onSelect={(event) => {
              event.preventDefault()
              onSelect(group.name)
            }}
          >
            <div className="flex min-w-0 flex-1 flex-col items-start">
              <span className="truncate font-medium">{group.name}</span>
              <span className="text-[0.625rem] text-muted-foreground">
                {group.type} · {nodeCountLabel(group.members.length)}
              </span>
            </div>
            {selectedGroup === group.name && <CheckIcon />}
          </DropdownMenuItem>
        ))}

        {groups.length === 0 && (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground">{emptyText}</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ProxyVirtualList({
  parentRef,
  className,
  totalSize,
  virtualItems,
  renderList,
  activeStickyIndex,
  isChainMode,
  measureElement,
  onLocation,
  onCheckAll,
  onHeadState,
  onChangeProxy,
}: {
  parentRef: RefObject<HTMLDivElement | null>
  className: string
  totalSize: number
  virtualItems: VirtualListItem[]
  renderList: IRenderItem[]
  activeStickyIndex: number | null
  isChainMode?: boolean
  measureElement: (node: Element | null) => void
  onLocation: (group: any) => void
  onCheckAll: (groupName: string) => void
  onHeadState: (groupName: string, patch: Partial<HeadState>) => void
  onChangeProxy: (group: ProxyGroupView, member: ResolvedProxyMember) => void
}) {
  return (
    <div ref={parentRef} className={cn('overflow-auto', className)}>
      <div className="relative" style={{ height: totalSize }}>
        {virtualItems.map((virtualItem) => {
          const isSticky = virtualItem.index === activeStickyIndex
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={measureElement}
              className={cn(
                'top-0 left-0 w-full',
                isSticky ? 'sticky z-5 flow-root bg-background' : 'absolute',
              )}
              style={{
                transform: isSticky
                  ? undefined
                  : `translateY(${virtualItem.start}px)`,
              }}
            >
              <ProxyRender
                item={renderList[virtualItem.index]}
                onLocation={onLocation}
                onCheckAll={onCheckAll}
                onHeadState={onHeadState}
                onChangeProxy={onChangeProxy}
                isChainMode={isChainMode}
              />
            </div>
          )
        })}
        <div className="h-2" />
      </div>
    </div>
  )
}

export function ProxyGroupsChain(props: ProxyGroupsChainProps) {
  const { t } = useTranslation()
  const {
    mode,
    chainConfigData,
    availableGroups,
    activeSelectedGroup,
    showScrollTop,
    parentRef,
    totalSize,
    virtualItems,
    renderList,
    activeStickyIndex,
    measureElement,
    onCheckAll,
    onHeadState,
    onLocation,
    onGroupSelect,
    onScrollToTop,
  } = props
  const { proxyView } = useProxiesData()
  const { onDragEnd: onHeaderDragEnd } = useProxyGroupHeaderLayout()

  const [proxyChain, setProxyChain] = useState<ProxyChainItem[]>(() => {
    try {
      const saved = localStorage.getItem('proxy-chain-items')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {}
    return []
  })

  const candidateNodes = useMemo(
    () =>
      renderList.flatMap((item) => {
        const occurrences = item.memberCol ?? (item.member ? [item.member] : [])
        return occurrences.flatMap(({ member }) =>
          member.kind === 'node' ? [member.node] : [],
        )
      }),
    [renderList],
  )

  const currentProxyChain = useMemo(
    () =>
      proxyView
        ? rebindProxyChainItems(proxyChain, candidateNodes, proxyView)
        : proxyChain.map((item) => ({
            ...item,
            recordId: undefined,
            delay: undefined,
          })),
    [candidateNodes, proxyChain, proxyView],
  )

  useEffect(() => {
    if (currentProxyChain.length > 0) {
      const persistedChain = currentProxyChain.map(
        ({ id, name, type, delay }) => ({
          id,
          name,
          type,
          delay,
        }),
      )
      localStorage.setItem('proxy-chain-items', JSON.stringify(persistedChain))
    } else {
      localStorage.removeItem('proxy-chain-items')
    }
  }, [currentProxyChain])

  const [ruleMenuOpen, setRuleMenuOpen] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    open: boolean
    message: string
  }>({ open: false, message: '' })

  const currentGroup = useMemo(() => {
    if (!activeSelectedGroup) return null
    return (
      availableGroups.find(
        (group: ProxyGroupView) => group.name === activeSelectedGroup,
      ) ?? null
    )
  }, [activeSelectedGroup, availableGroups])

  const handleGroupMenuClose = () => {
    setRuleMenuOpen(false)
  }

  const handleGroupSelect = async (groupName: string) => {
    if (mode === 'rule') {
      try {
        const result = await mutate(
          () => updateProxyChainConfigInRuntime(null),
          {
            id: 'update-proxy-chain-runtime',
          },
        )
        if (!result.ok) return
      } catch {
        return
      }
      localStorage.removeItem('proxy-chain-group')
      localStorage.removeItem('proxy-chain-exit-node')
      localStorage.removeItem('proxy-chain-items')
      setProxyChain([])
    }
    onGroupSelect(groupName)
    handleGroupMenuClose()
  }

  const handleCloseDuplicateWarning = useCallback(() => {
    setDuplicateWarning({ open: false, message: '' })
  }, [])

  useEffect(() => {
    if (!duplicateWarning.open) return
    const timer = setTimeout(handleCloseDuplicateWarning, 3000)
    return () => clearTimeout(timer)
  }, [duplicateWarning, handleCloseDuplicateWarning])

  const handleChangeProxy = useCallback(
    (_group: ProxyGroupView, member: ResolvedProxyMember) => {
      if (!isInteractableMember(member) || member.kind !== 'node') return
      const { node } = member
      setProxyChain((prev) => {
        const current = proxyView
          ? rebindProxyChainItems(prev, candidateNodes, proxyView)
          : prev
        if (
          current.some(
            (item) =>
              item.recordId !== undefined && item.recordId === node.recordId,
          )
        ) {
          const warningMessage = t('proxies.page.chain.duplicateNode')
          setDuplicateWarning({
            open: true,
            message: warningMessage,
          })
          return prev
        }

        const delay =
          node.history.length > 0
            ? node.history[node.history.length - 1].delay
            : undefined

        const chainItem: ProxyChainItem = {
          id: `${node.name}_${Date.now()}`,
          name: node.name,
          recordId: node.recordId,
          source: node.source,
          type: node.type,
          delay,
        }

        return [...current, chainItem]
      })
    },
    [candidateNodes, proxyView, t],
  )

  const showRuleHeader = mode === 'rule' && availableGroups.length > 0

  return (
    <>
      <div className="flex h-full gap-4">
        <div className="relative flex min-w-0 flex-1 flex-col">
          {showRuleHeader && (
            <ChainRuleHeader
              title={t('proxies.page.rules.title')}
              currentGroup={currentGroup}
              canSelectGroup={availableGroups.length > 0}
              groupMenu={
                <GroupSelectMenu
                  open={ruleMenuOpen}
                  selectLabel={t('proxies.page.rules.select')}
                  groups={availableGroups}
                  selectedGroup={activeSelectedGroup}
                  emptyText={t('proxies.page.empty.noAvailableGroups')}
                  nodeCountLabel={(count) =>
                    t('proxies.page.labels.nodeCount', { count })
                  }
                  onOpenChange={setRuleMenuOpen}
                  onSelect={(groupName) => {
                    handleGroupSelect(groupName).catch(() => {})
                  }}
                />
              }
            />
          )}

          <DragDropProvider
            sensors={PROXY_GROUP_HEADER_SENSORS}
            onDragEnd={onHeaderDragEnd}
          >
            <ProxyVirtualList
              parentRef={parentRef}
              className="min-h-0 flex-1"
              totalSize={totalSize}
              virtualItems={virtualItems}
              renderList={renderList}
              activeStickyIndex={activeStickyIndex}
              isChainMode
              measureElement={measureElement}
              onLocation={onLocation}
              onCheckAll={onCheckAll}
              onHeadState={onHeadState}
              onChangeProxy={handleChangeProxy}
            />
          </DragDropProvider>
          <ScrollTopButton show={showScrollTop} onClick={onScrollToTop} />
        </div>

        <div className="w-100 min-w-75 py-2 pr-2">
          <ProxyChain
            proxyChain={currentProxyChain}
            onUpdateChain={setProxyChain}
            chainConfigData={chainConfigData}
            mode={mode}
            selectedGroup={activeSelectedGroup}
          />
        </div>
      </div>

      {duplicateWarning.open && (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <Alert className="pointer-events-auto w-auto max-w-md border-warning/50 shadow-lg duration-150 animate-in fade-in-0 slide-in-from-top-2">
            <TriangleAlertIcon className="text-warning" />
            <AlertDescription className="text-foreground">
              {duplicateWarning.message}
            </AlertDescription>
            <AlertAction>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCloseDuplicateWarning}
              >
                <XIcon />
              </Button>
            </AlertAction>
          </Alert>
        </div>
      )}
    </>
  )
}
