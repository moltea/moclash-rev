import { useLockFn } from 'ahooks'
import { CheckIcon, GaugeIcon, PinIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useProfiles } from '@/hooks/use-profiles'
import { useProxyDelayState } from '@/hooks/use-proxy-delay-state'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useVerge } from '@/hooks/use-verge'
import {
  useAppRefreshers,
  useClashConfigData,
  useProxiesData,
} from '@/providers/app-data-context'
import { syncTrayProxySelection } from '@/services/cmds'
import delayManager from '@/services/delay'
import { mutate } from '@/services/mutate'
import { profileTestUrls } from '@/services/proxy-test-url'
import {
  isInteractableMember,
  memberDetails,
  resolveMember,
  type ProxyGroupView,
  type ResolvedProxyMember,
} from '@/types/proxy-view'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/ui/select'
import { Spinner } from '@ui/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

const STORAGE_KEY_GROUP = 'clash-verge-selected-proxy-group'
const PRIMARY_GROUP_KEYWORDS = [
  'auto',
  'select',
  'proxy',
  '节点选择',
  '自动选择',
]

const DELAY_COLOR_CLASS: Record<string, string> = {
  'error.main': 'text-destructive',
  'warning.main': 'text-warning',
  'primary.main': 'text-info',
  'success.main': 'text-success',
}

const readStoredGroup = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStoredGroup = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch (error) {
    console.warn('[QuickPanel] failed to remember proxy group:', error)
  }
}

interface ProxyRowProps {
  group: ProxyGroupView
  member: ResolvedProxyMember
  selected: boolean
  onSelect: (member: ResolvedProxyMember) => void
}

const ProxyRow = ({ group, member, selected, onSelect }: ProxyRowProps) => {
  const { delayValue, isPreset, timeout } = useProxyDelayState(
    member,
    group.name,
  )
  const name = member.ref.name
  const unresolved = member.kind === 'unresolved'
  const type = unresolved ? member.ref.reason : memberDetails(member)?.type

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={unresolved}
      title={type ? `${name}\n${type}` : name}
      onClick={() => onSelect(member)}
      className={cn(
        'flex h-8 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-xs/relaxed transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50',
        selected &&
          'bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary',
      )}
    >
      <CheckIcon
        className={cn('size-3.5 shrink-0', !selected && 'invisible')}
      />
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {group.fixed === name && (
        <PinIcon className="size-3 shrink-0 text-warning" />
      )}
      {!unresolved && !isPreset && delayValue === -2 && (
        <Spinner className="size-3 shrink-0 text-muted-foreground" />
      )}
      {!unresolved && !isPreset && delayValue >= 0 && (
        <Badge
          variant="outline"
          className={cn(
            'shrink-0 border-transparent bg-transparent px-1 tabular-nums dark:bg-transparent',
            DELAY_COLOR_CLASS[
              delayManager.formatDelayColor(delayValue, timeout)
            ] ?? 'text-muted-foreground',
          )}
        >
          {delayManager.formatDelay(delayValue, timeout)}
        </Badge>
      )}
    </button>
  )
}

export const QuickPanelProxies = () => {
  const { t } = useTranslation()
  const { proxyView, isProxyViewPending } = useProxiesData()
  const { clashConfig } = useClashConfigData()
  const { refreshProxy } = useAppRefreshers()
  const { verge } = useVerge()
  const { current: currentProfile } = useProfiles()
  const listRef = useRef<HTMLDivElement>(null)

  const mode = clashConfig?.mode?.toLowerCase() || 'rule'
  const isGlobalMode = mode === 'global'
  const isDirectMode = mode === 'direct'

  const storageKey = currentProfile?.uid
    ? `${STORAGE_KEY_GROUP}:${currentProfile.uid}`
    : STORAGE_KEY_GROUP
  const savedGroup = useMemo(() => readStoredGroup(storageKey), [storageKey])
  const [pickedGroup, setPickedGroup] = useState<string | null>(null)

  const { handleProxyGroupChange } = useProxySelection({
    onSuccess: () => {
      refreshProxy()
    },
    onError: (error) => {
      console.error('[QuickPanel] proxy switch failed:', error)
      refreshProxy()
    },
  })

  const selectableGroups = useMemo(
    () =>
      proxyView?.groups.filter(
        (group) =>
          !group.hidden &&
          (group.type === 'Selector' || group.type === 'URLTest'),
      ) ?? [],
    [proxyView],
  )

  const ruleGroupName =
    [pickedGroup, savedGroup].find(
      (name) => name && selectableGroups.some((group) => group.name === name),
    ) ??
    (
      selectableGroups.find((group) =>
        PRIMARY_GROUP_KEYWORDS.some((keyword) =>
          group.name.toLowerCase().includes(keyword),
        ),
      ) ?? selectableGroups[0]
    )?.name

  const selectedGroup = useMemo<ProxyGroupView | null>(() => {
    if (!proxyView || isDirectMode) return null
    if (isGlobalMode) return proxyView.global ?? null
    return selectableGroups.find(({ name }) => name === ruleGroupName) ?? null
  }, [isDirectMode, isGlobalMode, proxyView, ruleGroupName, selectableGroups])

  const members = useMemo(
    () =>
      proxyView && selectedGroup
        ? selectedGroup.members.map((ref, index) => {
            const member = resolveMember(proxyView, ref)
            return {
              key: `${index}:${member.kind === 'node' ? member.node.recordId : member.ref.name}`,
              member,
            }
          })
        : [],
    [proxyView, selectedGroup],
  )

  useEffect(() => {
    if (!selectedGroup) return
    const customUrl = currentProfile
      ? profileTestUrls(currentProfile)[selectedGroup.name]
      : undefined
    delayManager.setUrl(
      selectedGroup.name,
      customUrl?.trim() ||
        selectedGroup.testUrl?.trim() ||
        verge?.default_latency_test?.trim() ||
        'http://cp.cloudflare.com/generate_204',
    )
  }, [selectedGroup, currentProfile, verge?.default_latency_test])

  const selectedGroupName = selectedGroup?.name
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'center' })
  }, [selectedGroupName])

  const handleGroupChange = (name: string) => {
    setPickedGroup(name)
    writeStoredGroup(storageKey, name)
  }

  const handleSelect = (member: ResolvedProxyMember) => {
    if (!selectedGroup || !isInteractableMember(member)) return
    handleProxyGroupChange(selectedGroup, member.ref)
  }

  const handleCheckDelay = useLockFn(async () => {
    if (!selectedGroup) return
    const groupName = selectedGroup.name
    const timeout = verge?.default_latency_timeout || 10000
    const interactable = members
      .map(({ member }) => member)
      .filter(isInteractableMember)
      .filter(({ ref }) => ref.name !== 'DIRECT' && ref.name !== 'REJECT')

    if (interactable.length > 0) {
      try {
        await delayManager.checkListDelay(interactable, groupName, timeout)
      } catch (error) {
        console.error(`[QuickPanel] delay test failed: ${groupName}`, error)
      }
    }

    refreshProxy()
    mutate(() => syncTrayProxySelection(), {
      id: 'sync-tray-selection',
      errorNotice: false,
    }).catch((error) => {
      console.error('[QuickPanel] failed to sync tray latency:', error)
    })
  })

  if (isDirectMode) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-md bg-muted/50 px-4 text-center text-xs/relaxed text-muted-foreground">
        {t('home.components.clashMode.descriptions.direct')}
      </div>
    )
  }

  const canPickGroup = !isGlobalMode && selectableGroups.length > 1
  const delayLabel = t('home.components.currentProxy.actions.refreshDelay')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-1.5">
        {canPickGroup ? (
          <Select
            value={selectedGroupName ?? ''}
            onValueChange={handleGroupChange}
          >
            <SelectTrigger
              className="min-w-0 flex-1"
              aria-label={t('home.components.currentProxy.labels.group')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              className="max-h-64 w-(--radix-select-trigger-width)"
            >
              {selectableGroups.map((group) => (
                <SelectItem key={group.name} value={group.name}>
                  <span className="truncate" title={group.name}>
                    {group.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span
            className="min-w-0 flex-1 truncate px-0.5 text-xs font-medium"
            title={selectedGroupName}
          >
            {selectedGroupName ?? '-'}
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCheckDelay}
              disabled={members.length === 0}
              aria-label={delayLabel}
            >
              <GaugeIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{delayLabel}</TooltipContent>
        </Tooltip>
      </div>

      {selectedGroup && members.length > 0 ? (
        <div
          ref={listRef}
          role="listbox"
          aria-label={selectedGroup.name}
          className="-mx-1 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-1"
        >
          {members.map(({ key, member }) => (
            <ProxyRow
              key={key}
              group={selectedGroup}
              member={member}
              selected={member.ref.name === selectedGroup.now}
              onSelect={handleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-muted-foreground">
          {isProxyViewPending ? (
            <Spinner />
          ) : (
            t('layout.components.quickPanel.noProxies')
          )}
        </div>
      )}
    </div>
  )
}
