import { ChevronDownIcon, ChevronUpIcon, InboxIcon } from 'lucide-react'
import { type KeyboardEvent, memo, useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { HeadState } from '@/components/proxy/use-head-state'
import type { IRenderItem } from '@/components/proxy/use-render-list'
import { useIconCache } from '@/hooks/use-icon-cache'
import { useVerge } from '@/hooks/use-verge'
import type { ResolvedProxyMember } from '@/types/proxy-view'
import { Badge } from '@ui/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

import { ProxyGroupHeaderBlock } from './proxy-group-header-block'
import { ProxyGroupTools } from './proxy-group-tools'
import { ProxyHead } from './proxy-head'
import { ProxyItem } from './proxy-item'
import { ProxyItemMini } from './proxy-item-mini'

interface RenderProps {
  item: IRenderItem
  stickyed?: boolean
  isChainMode?: boolean
  onLocation: (group: IRenderItem['group']) => void
  onCheckAll: (groupName: string) => void
  onHeadState: (groupName: string, patch: Partial<HeadState>) => void
  onChangeProxy: (
    group: IRenderItem['group'],
    member: ResolvedProxyMember,
  ) => void
  onGroupToggle?: (group: IRenderItem['group']) => void
}

export const ProxyRender = memo(function ProxyRender(props: RenderProps) {
  const { t } = useTranslation()
  const {
    item,
    stickyed = false,
    onLocation,
    onCheckAll,
    onHeadState,
    onChangeProxy,
    onGroupToggle,
    isChainMode: _ = false,
  } = props
  const { type, group, headState, member, memberCol } = item
  const { verge } = useVerge()
  const enable_group_icon = verge?.enable_group_icon ?? true
  const toolsOnLeft = verge?.proxy_group_tools_position === 'left'
  const headerId = useId()
  const iconCachePath = useIconCache({
    icon: group.icon,
    cacheKey: group.name.replaceAll(' ', ''),
    enabled: enable_group_icon,
  })

  const showType = headState?.showType
  const memberColItemsMemo = useMemo(() => {
    if (type !== 4 || !memberCol) {
      return null
    }

    return memberCol.map((occurrence) => (
      <ProxyItemMini
        key={`${item.key}-${occurrence.memberIndex}`}
        group={group}
        member={occurrence.member}
        selected={group.now === occurrence.member.ref.name}
        showType={showType}
        onClick={(nextMember) => onChangeProxy(group, nextMember)}
      />
    ))
  }, [type, memberCol, item.key, group, showType, onChangeProxy])

  if (type === 0) {
    const toggleGroup = () => {
      if (headState?.open) {
        onGroupToggle?.(group)
      }
      onHeadState?.(group.name, { open: !headState?.open })
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggleGroup()
      }
    }

    const iconTrimmed = group.icon?.trim()
    const iconSrc = !enable_group_icon
      ? null
      : iconTrimmed?.startsWith('http')
        ? iconCachePath === ''
          ? group.icon
          : iconCachePath
        : iconTrimmed?.startsWith('data')
          ? group.icon
          : iconTrimmed?.startsWith('<svg')
            ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(group.icon!)}`
            : null

    const nameBlock = (
      <ProxyGroupHeaderBlock
        key="name"
        group={headerId}
        block="name"
        className={cn('flex-[0_1_auto] gap-2.5', toolsOnLeft && 'mr-2')}
      >
        {iconSrc && (
          <img
            src={iconSrc}
            alt={group.name}
            className="w-7 shrink-0 rounded-md"
          />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold">{group.name}</span>
          <div className="flex min-w-0 items-center gap-1.5">
            <Badge variant="outline" className="h-4 rounded-sm px-1">
              {group.type}
            </Badge>
            <span className="truncate text-xs text-muted-foreground">
              {group.now}
            </span>
          </div>
        </div>
      </ProxyGroupHeaderBlock>
    )

    const proxyCount = (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex min-w-12 items-center',
              toolsOnLeft ? 'justify-start' : 'justify-end',
            )}
          >
            <Badge
              variant="secondary"
              className={cn('tabular-nums', !toolsOnLeft && 'mr-2')}
            >
              {group.members.length}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>{t('proxies.page.labels.proxyCount')}</TooltipContent>
      </Tooltip>
    )

    const toolsBlock = (
      <ProxyGroupHeaderBlock
        key="tools"
        group={headerId}
        block="tools"
        className={cn(
          'flex-[1_1_auto]',
          toolsOnLeft ? 'mr-4 justify-start' : 'justify-end',
        )}
      >
        {toolsOnLeft && proxyCount}
        <ProxyGroupTools
          side={toolsOnLeft ? 'left' : 'right'}
          url={group.testUrl!}
          groupName={group.name}
          headState={headState!}
          onLocation={() => onLocation(group)}
          onCheckDelay={() => onCheckAll(group.name)}
          onHeadState={(p) => onHeadState(group.name, p)}
        />
        {!toolsOnLeft && proxyCount}
      </ProxyGroupHeaderBlock>
    )

    return (
      <div className="px-2 py-1">
        <div
          role="button"
          tabIndex={0}
          aria-expanded={!!headState?.open}
          className={cn(
            'flex h-full w-full items-center rounded-lg border bg-card px-3 py-2 text-start outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30',
            stickyed && headState?.open && 'shadow-md',
          )}
          onClick={toggleGroup}
          onKeyDown={handleKeyDown}
        >
          {toolsOnLeft ? toolsBlock : nameBlock}
          {toolsOnLeft ? nameBlock : toolsBlock}
          {headState?.open ? (
            <ChevronUpIcon className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
        </div>
      </div>
    )
  }

  if (type === 1) {
    return (
      <ProxyHead
        className="mt-1 mb-2 pr-6 pl-4"
        url={group.testUrl!}
        groupName={group.name}
        headState={headState!}
        onLocation={() => onLocation(group)}
        onCheckDelay={() => onCheckAll(group.name)}
        onHeadState={(p) => onHeadState(group.name, p)}
      />
    )
  }

  if (type === 2) {
    return (
      <ProxyItem
        group={group}
        member={member!.member}
        selected={group.now === member?.member.ref.name}
        showType={headState?.showType}
        className="px-4"
        onClick={(nextMember) => onChangeProxy(group, nextMember)}
      />
    )
  }

  if (type === 3) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-4 text-muted-foreground">
        <InboxIcon className="size-8" />
        <span className="text-xs">{t('proxies.page.empty.noProxies')}</span>
      </div>
    )
  }

  if (type === 4) {
    return (
      <div
        className="my-1 grid h-12 gap-2 px-4"
        style={{
          gridTemplateColumns: `repeat(${item.col! || 2}, minmax(0, 1fr))`,
        }}
      >
        {memberColItemsMemo}
      </div>
    )
  }

  return null
})
