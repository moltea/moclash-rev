import { CircleCheckIcon } from 'lucide-react'
import type { ComponentProps, KeyboardEvent, MouseEvent } from 'react'
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

const DELAY_COLOR_CLASS: Record<string, string> = {
  'error.main': 'text-destructive',
  'warning.main': 'text-warning',
  'primary.main': 'text-info',
  'success.main': 'text-success',
}

export const ProxyTypeBadge = ({
  className,
  ...props
}: ComponentProps<typeof Badge>) => (
  <Badge
    variant="outline"
    className={cn(
      'h-4 rounded-sm px-1 text-[0.625rem] font-normal text-muted-foreground',
      className,
    )}
    {...props}
  />
)

export const PROXY_ROW_CLASS =
  'group/proxy flex w-full items-center rounded-md border bg-card text-start outline-none transition-colors hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30'

export const PROXY_ROW_SELECTED_CLASS =
  'border-primary/30 border-l-3 border-l-primary bg-primary/10 hover:bg-primary/15'

interface Props {
  group: ProxyGroupView
  member: ResolvedProxyMember
  selected: boolean
  showType?: boolean
  className?: string
  onClick?: (member: ResolvedProxyMember) => void
}

export const ProxyItem = (props: Props) => {
  const { t } = useTranslation()
  const { group, member, selected, showType = true, className, onClick } = props
  const details = memberDetails(member)
  const unresolved = member.kind === 'unresolved'
  const name = member.ref.name
  const type = unresolved ? member.ref.reason : (details?.type ?? '')
  const now = member.kind === 'group' ? member.group.now : undefined

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
    <div className={className}>
      <div
        role="button"
        tabIndex={unresolved ? -1 : 0}
        aria-disabled={unresolved || undefined}
        aria-pressed={!unresolved && selected}
        className={cn(
          PROXY_ROW_CLASS,
          'mb-1.5 h-9 gap-2 px-3',
          !unresolved && selected && PROXY_ROW_SELECTED_CLASS,
          unresolved && 'pointer-events-none opacity-50',
        )}
        onClick={unresolved ? undefined : () => onClick?.(member)}
        onKeyDown={handleKeyDown}
      >
        <div title={name} className="flex min-w-0 flex-1 items-center gap-1">
          <span className="mr-1 truncate text-xs font-medium">
            {name}
            {showType && now && ` - ${now}`}
          </span>
          {showType && <ProxyTypeBadge>{type}</ProxyTypeBadge>}
          {!unresolved && showType && details?.udp && (
            <ProxyTypeBadge>UDP</ProxyTypeBadge>
          )}
          {!unresolved && showType && details?.xudp && (
            <ProxyTypeBadge>XUDP</ProxyTypeBadge>
          )}
          {!unresolved && showType && details?.tfo && (
            <ProxyTypeBadge>TFO</ProxyTypeBadge>
          )}
          {!unresolved && showType && details?.mptcp && (
            <ProxyTypeBadge>MPTCP</ProxyTypeBadge>
          )}
          {!unresolved && showType && details?.smux && (
            <ProxyTypeBadge>SMUX</ProxyTypeBadge>
          )}
        </div>

        <div
          className={cn(
            'flex shrink-0 items-center justify-end',
            isPreset && 'hidden',
          )}
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

          {!unresolved && delayValue > 0 && (
            <Badge
              asChild
              variant="outline"
              className={cn(
                'cursor-pointer tabular-nums hover:bg-muted',
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

          {!unresolved && delayValue !== -2 && delayValue <= 0 && selected && (
            <CircleCheckIcon className="size-4 text-primary group-hover/proxy:hidden" />
          )}
        </div>
      </div>
    </div>
  )
}
