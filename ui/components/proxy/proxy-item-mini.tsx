import { CircleCheckIcon, PinIcon } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { useProxyDelayState } from '@/hooks/use-proxy-delay-state'
import delayManager from '@/services/delay'
import {
  memberDetails,
  type ProxyGroupView,
  type ResolvedProxyMember,
} from '@/types/proxy-view'
import { BaseLoading } from '@ui/components/base'
import { Badge } from '@ui/components/ui/badge'
import { cn } from '@ui/lib/utils'

import {
  PROXY_ROW_CLASS,
  PROXY_ROW_SELECTED_CLASS,
  ProxyTypeBadge,
} from './proxy-item'

const DELAY_COLOR_CLASS: Record<string, string> = {
  'error.main': 'text-destructive',
  'warning.main': 'text-warning',
  'primary.main': 'text-info',
  'success.main': 'text-success',
}

interface Props {
  group: ProxyGroupView
  member: ResolvedProxyMember
  selected: boolean
  showType?: boolean
  onClick?: (member: ResolvedProxyMember) => void
}

export const ProxyItemMini = (props: Props) => {
  const { group, member, selected, showType = true, onClick } = props
  const details = memberDetails(member)
  const unresolved = member.kind === 'unresolved'
  const name = member.ref.name
  const type = unresolved ? member.ref.reason : (details?.type ?? '')
  const now = member.kind === 'group' ? member.group.now : undefined

  const { t } = useTranslation()

  const { delayValue, isPreset, timeout, onDelay } = useProxyDelayState(
    member,
    group.name,
  )
  const showDelay = delayValue > 0

  const handleDelay = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    void onDelay()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (unresolved || e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.(member)
    }
  }

  return (
    <div
      role="button"
      tabIndex={unresolved ? -1 : 0}
      aria-disabled={unresolved || undefined}
      aria-pressed={!unresolved && selected}
      className={cn(
        PROXY_ROW_CLASS,
        'relative h-12 justify-between gap-1 pr-2 pl-3',
        !unresolved && selected && PROXY_ROW_SELECTED_CLASS,
        unresolved && 'pointer-events-none opacity-50',
      )}
      onClick={unresolved ? undefined : () => onClick?.(member)}
      onKeyDown={handleKeyDown}
    >
      <div
        title={`${name}\n${now ?? ''}`}
        className="flex min-w-0 flex-col gap-1 overflow-hidden"
      >
        <div className="truncate text-xs font-medium">{name}</div>

        {showType && (
          <div className="flex flex-none flex-nowrap items-center gap-1">
            {now && (
              <div className="mr-1 truncate text-[0.625rem] text-muted-foreground">
                {now}
              </div>
            )}
            <ProxyTypeBadge>{type}</ProxyTypeBadge>
            {!unresolved && details?.udp && (
              <ProxyTypeBadge>UDP</ProxyTypeBadge>
            )}
            {!unresolved && details?.xudp && (
              <ProxyTypeBadge>XUDP</ProxyTypeBadge>
            )}
            {!unresolved && details?.tfo && (
              <ProxyTypeBadge>TFO</ProxyTypeBadge>
            )}
            {!unresolved && details?.mptcp && (
              <ProxyTypeBadge>MPTCP</ProxyTypeBadge>
            )}
            {!unresolved && details?.smux && (
              <ProxyTypeBadge>SMUX</ProxyTypeBadge>
            )}
          </div>
        )}
      </div>

      <div
        className={cn('ml-1 flex shrink-0 items-center', isPreset && 'hidden')}
      >
        {!unresolved && delayValue === -2 && (
          <BaseLoading className="mx-1 size-3.5" />
        )}

        {!unresolved && delayValue !== -2 && (
          <Badge
            asChild
            variant="ghost"
            className={cn(
              'hidden cursor-pointer',
              !showDelay && 'group-hover/proxy:inline-flex',
            )}
          >
            <button type="button" onClick={handleDelay}>
              {t('shared.actions.check')}
            </button>
          </Badge>
        )}

        {!unresolved && delayValue >= 0 && (
          <Badge
            asChild
            variant="outline"
            className={cn(
              'cursor-pointer tabular-nums hover:bg-muted',
              !showDelay && 'group-hover/proxy:hidden',
              DELAY_COLOR_CLASS[
                delayManager.formatDelayColor(delayValue, timeout)
              ] ?? 'text-muted-foreground',
            )}
          >
            <button type="button" onClick={handleDelay}>
              {delayManager.formatDelay(delayValue, timeout)}
            </button>
          </Badge>
        )}

        {!unresolved &&
          type !== 'Direct' &&
          delayValue !== -2 &&
          delayValue < 0 &&
          selected && (
            <CircleCheckIcon className="mr-1 size-4 text-primary group-hover/proxy:hidden" />
          )}
      </div>

      {!unresolved && group.fixed && group.fixed === name && (
        <span
          className="absolute -top-1.5 -right-1.5"
          title={
            group.type === 'URLTest'
              ? t('proxies.page.labels.delayCheckReset')
              : ''
          }
        >
          <PinIcon
            className={cn(
              'size-3',
              name === group.now
                ? 'fill-primary text-primary'
                : 'text-muted-foreground',
            )}
          />
        </span>
      )}
    </div>
  )
}
