/* eslint-disable @eslint-react/set-state-in-effect */
import { useLockFn } from 'ahooks'
import {
  ArrowDownAZIcon,
  ArrowDownUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  GaugeIcon,
  PinIcon,
  SignalHighIcon,
  SignalIcon,
  SignalLowIcon,
  SignalMediumIcon,
  SignalZeroIcon,
  WifiOffIcon,
} from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import type { ProxySortType } from '@/components/proxy/use-filter-sort'
import { useGroupDelays } from '@/hooks/use-group-delays'
import { useProfiles } from '@/hooks/use-profiles'
import { useProxySelection } from '@/hooks/use-proxy-selection'
import { useVerge } from '@/hooks/use-verge'
import {
  useAppRefreshers,
  useClashConfigData,
  useCoreDataStatus,
  useProxiesData,
} from '@/providers/app-data-context'
import { syncTrayProxySelection } from '@/services/cmds'
import delayManager from '@/services/delay'
import { mutate } from '@/services/mutate'
import { profileTestUrls } from '@/services/proxy-test-url'
import {
  findCurrentGroupMember,
  getRecord,
  isInteractableMember,
  memberDetails,
  resolveMember,
  type ProxyGroupView,
  type ResolvedProxyMember,
} from '@/types/proxy-view'
import { debugLog } from '@/utils/debug'
import { compareByDelay, DEFAULT_DELAY_TIMEOUT } from '@/utils/delay'
import { EnhancedCard } from '@ui/components/home/enhanced-card'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@ui/components/ui/popover'
import { Skeleton } from '@ui/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

const STORAGE_KEY_GROUP = 'clash-verge-selected-proxy-group'
const STORAGE_KEY_SORT_TYPE = 'clash-verge-proxy-sort-type'

const AUTO_CHECK_DEFAULT_INTERVAL_MINUTES = 5
const AUTO_CHECK_INITIAL_DELAY_MS = 100
const PROXY_MENU_MAX_HEIGHT = 500
const PROXY_MENU_VIEWPORT_MARGIN = 8

interface ProxyOption {
  memberIndex: number
  member: ResolvedProxyMember
  value: string
  name: string
  disabled: boolean
}

type OpenSelect = 'group' | 'proxy' | null

type DelayColor = 'success' | 'warning' | 'error' | 'primary' | 'default'

const DELAY_BADGE_CLASSES: Record<DelayColor, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
  primary: 'bg-info/10 text-info',
  default: 'bg-muted text-muted-foreground',
}

function convertDelayColor(delayValue: number): DelayColor {
  const colorStr = delayManager.formatDelayColor(delayValue)
  if (!colorStr) return 'default'

  const mainColor = colorStr.split('.')[0]

  switch (mainColor) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
    case 'primary':
      return 'primary'
    default:
      return 'default'
  }
}

const DelayBadge = ({
  delay,
  className,
}: {
  delay: number
  className?: string
}) => (
  <Badge
    variant="outline"
    className={cn(
      'border-transparent tabular-nums',
      DELAY_BADGE_CLASSES[convertDelayColor(delay)],
      className,
    )}
  >
    {delayManager.formatDelay(delay)}
  </Badge>
)

function getSignalIcon(
  delay: number,
  translate: (key: string) => string,
): {
  icon: React.ReactElement
  text: string
  color: string
} {
  if (delay === -2)
    return {
      icon: <SignalZeroIcon />,
      text: translate('home.components.currentProxy.status.testing'),
      color: 'text-muted-foreground',
    }
  if (delay === -1)
    return {
      icon: <SignalZeroIcon />,
      text: translate('home.components.currentProxy.status.untested'),
      color: 'text-muted-foreground',
    }
  if (delay > 1e5)
    return {
      icon: <WifiOffIcon />,
      text: translate('home.components.currentProxy.status.error'),
      color: 'text-destructive',
    }
  if (delay === 0 || delay >= 10000)
    return {
      icon: <WifiOffIcon />,
      text: translate('home.components.currentProxy.status.timeout'),
      color: 'text-destructive',
    }
  if (delay >= 500)
    return {
      icon: <SignalLowIcon />,
      text: translate('home.components.currentProxy.status.latencyHigh'),
      color: 'text-destructive',
    }
  if (delay >= 300)
    return {
      icon: <SignalMediumIcon />,
      text: translate('home.components.currentProxy.status.latencyMedium'),
      color: 'text-warning',
    }
  if (delay >= 200)
    return {
      icon: <SignalHighIcon />,
      text: translate('home.components.currentProxy.status.latencyGood'),
      color: 'text-info',
    }
  return {
    icon: <SignalIcon />,
    text: translate('home.components.currentProxy.status.latencyExcellent'),
    color: 'text-success',
  }
}

const optionValue = (memberIndex: number, member: ResolvedProxyMember) =>
  `${memberIndex}:${
    member.kind === 'node' ? member.node.recordId : member.ref.name
  }`

const sortProxyOptions = (
  options: ProxyOption[],
  sortType: ProxySortType,
  delayOf: (member: ResolvedProxyMember) => number,
  latencyTimeout?: number,
) => {
  if (sortType === 0) return options
  if (sortType === 2) {
    return [...options].sort((a, b) => a.name.localeCompare(b.name))
  }

  const effectiveTimeout =
    typeof latencyTimeout === 'number' && latencyTimeout > 0
      ? latencyTimeout
      : DEFAULT_DELAY_TIMEOUT

  return options
    .map((option) => ({ option, delay: delayOf(option.member) }))
    .sort((a, b) => {
      const byDelay = compareByDelay(a.delay, b.delay, effectiveTimeout)
      return byDelay || a.option.name.localeCompare(b.option.name)
    })
    .map(({ option }) => option)
}

const ENABLED_OPTION_SELECTOR = '[role="option"]:not([aria-disabled="true"])'

interface PersistentSelectProps {
  label: string
  displayValue: React.ReactNode
  open: boolean
  disabled: boolean
  keepOpenRef: React.RefObject<HTMLElement | null>
  onOpenChange: (open: boolean) => void
  renderOptions: () => React.ReactNode
}

const PersistentSelect = ({
  label,
  displayValue,
  open,
  disabled,
  keepOpenRef,
  onOpenChange,
  renderOptions,
}: PersistentSelectProps) => {
  const id = useId()
  const labelId = `${id}-label`
  const valueId = `${id}-value`
  const listboxId = `${id}-listbox`
  const listRef = useRef<HTMLDivElement>(null)

  const focusInitialOption = (event: Event) => {
    event.preventDefault()
    const list = listRef.current
    const item =
      list?.querySelector<HTMLElement>(
        '[aria-selected="true"]:not([aria-disabled="true"])',
      ) ?? list?.querySelector<HTMLElement>(ENABLED_OPTION_SELECTOR)
    if (!item || !list) return

    item.focus({ preventScroll: true })
    list.scrollTop +=
      item.getBoundingClientRect().top -
      list.getBoundingClientRect().top -
      (list.clientHeight - item.offsetHeight) / 2
  }

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      onOpenChange(false)
      return
    }
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>(ENABLED_OPTION_SELECTOR) ??
        [],
    )
    if (items.length === 0) return
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    let nextIndex: number | null = null
    switch (event.key) {
      case 'ArrowDown':
        nextIndex =
          currentIndex < 0 ? 0 : Math.min(currentIndex + 1, items.length - 1)
        break
      case 'ArrowUp':
        nextIndex = currentIndex < 0 ? items.length - 1 : currentIndex - 1
        if (nextIndex < 0) nextIndex = 0
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = items.length - 1
        break
    }
    if (nextIndex === null) return
    event.preventDefault()
    items[nextIndex].focus()
  }

  return (
    <div className="flex flex-col gap-1">
      <span
        id={labelId}
        className={cn(
          'px-0.5 text-[0.625rem] font-medium text-muted-foreground',
          disabled && 'opacity-50',
        )}
      >
        {label}
      </span>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-labelledby={`${labelId} ${valueId}`}
            aria-haspopup="listbox"
            aria-controls={open ? listboxId : undefined}
            aria-expanded={open}
            disabled={disabled}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                onOpenChange(true)
              }
            }}
            className="flex h-8 w-full items-center justify-between gap-1.5 rounded-md border border-input bg-input/20 px-2 text-left text-xs/relaxed transition-colors outline-none hover:bg-input/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50"
          >
            <div id={valueId} className="min-w-0 flex-1">
              {displayValue}
            </div>
            <ChevronDownIcon
              className={cn(
                'size-3.5 shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={PROXY_MENU_VIEWPORT_MARGIN}
          className="w-(--radix-popover-trigger-width) gap-0 overflow-hidden p-0"
          style={{
            maxHeight: `min(${PROXY_MENU_MAX_HEIGHT}px, var(--radix-popover-content-available-height))`,
          }}
          onOpenAutoFocus={focusInitialOption}
          onInteractOutside={(event) => {
            const target = event.target
            if (
              target instanceof Node &&
              keepOpenRef.current?.contains(target)
            ) {
              event.preventDefault()
            }
          }}
        >
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            onKeyDown={handleListKeyDown}
            className="min-h-0 flex-1 overflow-y-auto p-1"
          >
            {open && renderOptions()}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface PersistentOptionProps {
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  className?: string
  children: React.ReactNode
}

const PersistentOption = ({
  selected,
  disabled = false,
  onSelect,
  className,
  children,
}: PersistentOptionProps) => (
  <button
    type="button"
    role="option"
    aria-selected={selected}
    aria-disabled={disabled}
    disabled={disabled}
    onClick={() => {
      if (!disabled) onSelect()
    }}
    className={cn(
      'relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-selected:bg-accent/60 aria-selected:font-medium',
      className,
    )}
  >
    {children}
  </button>
)

interface PersistentProxySelectProps
  extends Omit<PersistentSelectProps, 'displayValue' | 'renderOptions'> {
  value: string
  selectedName: string
  groupName: string
  fixed?: string | null
  selectedDelay: number
  options: ProxyOption[]
  onChange: (value: string) => void
}

const PersistentProxySelect = ({
  groupName,
  fixed,
  selectedName,
  selectedDelay,
  options,
  value,
  onChange,
  ...props
}: PersistentProxySelectProps) => {
  const fixedProxyInUsed = selectedName === fixed

  return (
    <PersistentSelect
      {...props}
      displayValue={
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">{selectedName}</span>
          <div className="flex shrink-0 items-center gap-1">
            {fixedProxyInUsed && <PinIcon className="size-3 text-warning" />}
            <DelayBadge delay={selectedDelay} />
          </div>
        </div>
      }
      renderOptions={() =>
        options.map((option) => {
          const selected = option.value === value
          const isFixed = option.name === fixed
          const delay = option.disabled
            ? -1
            : delayManager.getDelayFix(option.member, groupName)

          return (
            <PersistentOption
              key={option.value}
              selected={selected}
              disabled={option.disabled}
              onSelect={() => onChange(option.value)}
              className="justify-between pe-1"
            >
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
              {isFixed && (
                <PinIcon
                  className={cn(
                    'size-3 shrink-0',
                    fixedProxyInUsed ? 'text-warning' : 'text-muted-foreground',
                  )}
                />
              )}
              {!option.disabled && (
                <DelayBadge delay={delay} className="min-w-[60px]" />
              )}
            </PersistentOption>
          )
        })
      }
    />
  )
}

export const CurrentProxyCard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { proxyView } = useProxiesData()
  const { clashConfig } = useClashConfigData()
  const { refreshProxy } = useAppRefreshers()
  const { isCoreDataPending } = useCoreDataStatus()
  const { verge } = useVerge()
  const { current: currentProfile } = useProfiles()
  const autoDelayEnabled = verge?.enable_auto_delay_detection ?? false
  const defaultLatencyTimeout = verge?.default_latency_timeout
  const autoDelayIntervalMs = useMemo(() => {
    const rawInterval = verge?.auto_delay_detection_interval_minutes
    const intervalMinutes =
      typeof rawInterval === 'number' && rawInterval > 0
        ? rawInterval
        : AUTO_CHECK_DEFAULT_INTERVAL_MINUTES
    return Math.max(1, Math.round(intervalMinutes)) * 60 * 1000
  }, [verge?.auto_delay_detection_interval_minutes])
  const currentProfileId = currentProfile?.uid || null

  const getProfileStorageKey = useCallback(
    (baseKey: string) =>
      currentProfileId ? `${baseKey}:${currentProfileId}` : baseKey,
    [currentProfileId],
  )

  const readProfileScopedItem = useCallback(
    (baseKey: string) => {
      if (typeof window === 'undefined') return null
      const profileKey = getProfileStorageKey(baseKey)
      const profileValue = localStorage.getItem(profileKey)
      if (profileValue != null) {
        return profileValue
      }

      if (profileKey !== baseKey) {
        const legacyValue = localStorage.getItem(baseKey)
        if (legacyValue != null) {
          localStorage.removeItem(baseKey)
          localStorage.setItem(profileKey, legacyValue)
          return legacyValue
        }
      }

      return null
    },
    [getProfileStorageKey],
  )

  const writeProfileScopedItem = useCallback(
    (baseKey: string, value: string) => {
      if (typeof window === 'undefined') return
      const profileKey = getProfileStorageKey(baseKey)
      localStorage.setItem(profileKey, value)
      if (profileKey !== baseKey) {
        localStorage.removeItem(baseKey)
      }
    },
    [getProfileStorageKey],
  )

  const { handleSelectChange } = useProxySelection({
    onSuccess: () => {
      refreshProxy()
    },
    onError: (error) => {
      console.error('代理切换失败', error)
      refreshProxy()
    },
  })

  const mode = clashConfig?.mode?.toLowerCase() || 'rule'
  const isGlobalMode = mode === 'global'
  const isDirectMode = mode === 'direct'

  const [sortType, setSortType] = useState<ProxySortType>(() => {
    const savedSortType = localStorage.getItem(STORAGE_KEY_SORT_TYPE)
    return savedSortType ? (Number(savedSortType) as ProxySortType) : 0
  })

  const [selectedGroupName, setSelectedGroupName] = useState('')
  const [openSelect, setOpenSelect] = useState<OpenSelect>(null)

  const [openSelectMode, setOpenSelectMode] = useState(mode)
  if (openSelectMode !== mode) {
    setOpenSelectMode(mode)
    setOpenSelect(null)
  }

  const delayButtonRef = useRef<HTMLButtonElement>(null)
  const delays = useGroupDelays(selectedGroupName || null)

  const autoCheckInProgressRef = useRef(false)
  const latestTimeoutRef = useRef<number>(
    verge?.default_latency_timeout || 10000,
  )
  const latestProxyMemberRef = useRef<ResolvedProxyMember | null>(null)

  useEffect(() => {
    latestTimeoutRef.current = verge?.default_latency_timeout || 10000
  }, [verge?.default_latency_timeout])

  const selectableGroups = useMemo(() => {
    if (!proxyView) return []
    return proxyView.groups.filter(
      (group) =>
        !group.hidden &&
        (group.type === 'Selector' || group.type === 'URLTest'),
    )
  }, [proxyView])

  const selectedGroup = useMemo<ProxyGroupView | null>(() => {
    if (!proxyView || isDirectMode) return null
    if (isGlobalMode) return proxyView.global
    return (
      selectableGroups.find(({ name }) => name === selectedGroupName) ?? null
    )
  }, [
    isDirectMode,
    isGlobalMode,
    proxyView,
    selectableGroups,
    selectedGroupName,
  ])

  const optionsForGroup = useCallback(
    (group: ProxyGroupView | null): ProxyOption[] =>
      proxyView && group
        ? group.members.map((memberRef, memberIndex) => {
            const member = resolveMember(proxyView, memberRef)
            return {
              memberIndex,
              member,
              value: optionValue(memberIndex, member),
              name: member.ref.name,
              disabled: !isInteractableMember(member),
            }
          })
        : [],
    [proxyView],
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

  const unsortedProxyOptions = useMemo(
    () => optionsForGroup(selectedGroup),
    [optionsForGroup, selectedGroup],
  )

  useEffect(() => {
    if (!proxyView) return
    if (isDirectMode) {
      setSelectedGroupName('DIRECT')
      return
    }
    if (isGlobalMode) {
      setSelectedGroupName(proxyView.global?.name ?? 'GLOBAL')
      return
    }

    const savedGroup = readProfileScopedItem(STORAGE_KEY_GROUP)
    const primaryKeywords = ['auto', 'select', 'proxy', '节点选择', '自动选择']
    const primaryGroup =
      selectableGroups.find((group) =>
        primaryKeywords.some((keyword) =>
          group.name.toLowerCase().includes(keyword.toLowerCase()),
        ),
      ) ?? selectableGroups[0]
    const nextGroup = selectableGroups.some(
      ({ name }) => name === selectedGroupName,
    )
      ? selectedGroupName
      : selectableGroups.some(({ name }) => name === savedGroup)
        ? savedGroup!
        : (primaryGroup?.name ?? '')
    if (nextGroup !== selectedGroupName) {
      setSelectedGroupName(nextGroup)
      if (nextGroup) writeProfileScopedItem(STORAGE_KEY_GROUP, nextGroup)
    }
  }, [
    isDirectMode,
    isGlobalMode,
    proxyView,
    readProfileScopedItem,
    selectableGroups,
    selectedGroupName,
    writeProfileScopedItem,
  ])

  const currentOption = useMemo(() => {
    if (!proxyView) return undefined
    if (isDirectMode) {
      const node =
        proxyView.direct == null
          ? undefined
          : getRecord(proxyView, proxyView.direct)
      return node
        ? ({
            memberIndex: 0,
            member: {
              kind: 'node',
              ref: { kind: 'node', name: node.name, recordId: node.recordId },
              node,
            },
          } satisfies Pick<ProxyOption, 'memberIndex' | 'member'>)
        : undefined
    }
    return selectedGroup
      ? findCurrentGroupMember(proxyView, selectedGroup)
      : undefined
  }, [isDirectMode, proxyView, selectedGroup])

  latestProxyMemberRef.current = currentOption?.member ?? null

  const handleGroupChange = useCallback(
    (newGroupName: string) => {
      if (isGlobalMode || isDirectMode) return
      setSelectedGroupName(newGroupName)
      writeProfileScopedItem(STORAGE_KEY_GROUP, newGroupName)
    },
    [isDirectMode, isGlobalMode, writeProfileScopedItem],
  )

  const handleProxyChange = useCallback(
    (value: string) => {
      if (isDirectMode) return
      const option = unsortedProxyOptions.find(
        (candidate) => candidate.value === value,
      )
      if (!selectedGroup || !option || !isInteractableMember(option.member)) {
        return
      }
      const previousProxy = selectedGroup.now
      const nextName = option.member.ref.name
      handleSelectChange(
        selectedGroup.name,
        previousProxy!,
        selectedGroup.fixed!,
      )({
        target: { value: nextName },
      })
    },
    [handleSelectChange, isDirectMode, selectedGroup, unsortedProxyOptions],
  )

  const goToProxies = useCallback(() => {
    navigate('/proxies')
  }, [navigate])

  const currentMember = currentOption?.member
  const currentProxy = currentMember ? memberDetails(currentMember) : undefined
  const selectedProxyName = currentMember?.ref.name ?? ''

  const currentDelay =
    currentMember && selectedGroupName
      ? delayManager.getDelayFix(currentMember, selectedGroupName)
      : -1

  const signalInfo =
    currentProxy && selectedGroupName
      ? getSignalIcon(currentDelay, t)
      : {
          icon: <SignalZeroIcon />,
          text: t('home.components.currentProxy.status.uninitialized'),
          color: 'text-muted-foreground',
        }

  const checkCurrentProxyDelay = useCallback(async () => {
    if (autoCheckInProgressRef.current) return
    if (isDirectMode) return

    const groupName = selectedGroupName
    const proxyName = selectedProxyName

    if (!groupName || !proxyName) return

    const proxyMember = latestProxyMemberRef.current
    if (!proxyMember || !isInteractableMember(proxyMember)) {
      debugLog(
        `[CurrentProxyCard] 自动延迟检测跳过，组: ${groupName}, 节点: ${proxyName} 未找到`,
      )
      return
    }

    autoCheckInProgressRef.current = true

    const timeout = latestTimeoutRef.current || 10000

    try {
      debugLog(
        `[CurrentProxyCard] 自动检测当前节点延迟，组: ${groupName}, 节点: ${proxyName}`,
      )
      await delayManager.checkDelay(proxyMember, groupName, timeout)
    } catch (error) {
      console.error(
        `[CurrentProxyCard] 自动检测当前节点延迟失败，组: ${groupName}, 节点: ${proxyName}`,
        error,
      )
    } finally {
      autoCheckInProgressRef.current = false
      refreshProxy()
    }
  }, [isDirectMode, refreshProxy, selectedGroupName, selectedProxyName])

  useEffect(() => {
    if (isDirectMode) return
    if (!autoDelayEnabled) return
    if (!selectedGroupName || !selectedProxyName) return

    let disposed = false
    let intervalTimer: ReturnType<typeof setTimeout> | null = null
    let initialTimer: ReturnType<typeof setTimeout> | null = null

    const runAndSchedule = async () => {
      if (disposed) return
      await checkCurrentProxyDelay()
      if (disposed) return
      intervalTimer = setTimeout(runAndSchedule, autoDelayIntervalMs)
    }

    initialTimer = setTimeout(async () => {
      await checkCurrentProxyDelay()
      if (disposed) return
      intervalTimer = setTimeout(runAndSchedule, autoDelayIntervalMs)
    }, AUTO_CHECK_INITIAL_DELAY_MS)

    return () => {
      disposed = true
      if (initialTimer) clearTimeout(initialTimer)
      if (intervalTimer) clearTimeout(intervalTimer)
    }
  }, [
    checkCurrentProxyDelay,
    autoDelayIntervalMs,
    isDirectMode,
    selectedGroupName,
    selectedProxyName,
    autoDelayEnabled,
  ])

  const handleSortTypeChange = useCallback(() => {
    const newSortType = ((sortType + 1) % 3) as ProxySortType
    setSortType(newSortType)
    localStorage.setItem(STORAGE_KEY_SORT_TYPE, newSortType.toString())
  }, [sortType])

  const handleCheckDelay = useLockFn(async () => {
    const groupName = selectedGroupName
    if (!groupName || isDirectMode) return

    debugLog(`[CurrentProxyCard] 开始测试所有延迟，组: ${groupName}`)

    const timeout = verge?.default_latency_timeout || 10000

    const interactable = unsortedProxyOptions
      .map(({ member }) => member)
      .filter(isInteractableMember)
      .filter(({ ref }) => ref.name !== 'DIRECT' && ref.name !== 'REJECT')

    if (interactable.length > 0) {
      const url = delayManager.getUrl(groupName)
      debugLog(`[CurrentProxyCard] 测试URL: ${url}, 超时: ${timeout}ms`)

      try {
        await delayManager.checkListDelay(interactable, groupName, timeout)
        debugLog(`[CurrentProxyCard] 延迟测试完成，组: ${groupName}`)
      } catch (error) {
        console.error(
          `[CurrentProxyCard] 延迟测试出错，组: ${groupName}`,
          error,
        )
      }
    }

    refreshProxy()
    mutate(() => syncTrayProxySelection(), {
      id: 'sync-tray-selection',
      errorNotice: false,
    }).catch((error) => {
      console.error('[CurrentProxyCard] Failed to sync tray latency:', error)
    })
  })

  const proxyOptions = useMemo(
    () =>
      isDirectMode || openSelect !== 'proxy'
        ? []
        : sortProxyOptions(
            unsortedProxyOptions,
            sortType,
            delays.of,
            defaultLatencyTimeout!,
          ),
    [
      delays,
      isDirectMode,
      openSelect,
      unsortedProxyOptions,
      sortType,
      defaultLatencyTimeout,
    ],
  )

  const getSortIcon = (): React.ReactElement => {
    switch (sortType) {
      case 1:
        return <ClockIcon />
      case 2:
        return <ArrowDownAZIcon />
      default:
        return <ArrowDownUpIcon />
    }
  }

  const getSortTooltip = (): string => {
    switch (sortType) {
      case 0:
        return t('proxies.page.tooltips.sortDefault')
      case 1:
        return t('proxies.page.tooltips.sortDelay')
      case 2:
        return t('proxies.page.tooltips.sortName')
      default:
        return ''
    }
  }

  return (
    <EnhancedCard
      title={t('home.components.currentProxy.title')}
      icon={
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'flex items-center justify-center',
                currentProxy ? signalInfo.color : 'text-muted-foreground/50',
              )}
            >
              {currentProxy ? signalInfo.icon : <SignalZeroIcon />}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {currentProxy
              ? `${signalInfo.text}: ${delayManager.formatDelay(currentDelay)}`
              : t('home.components.currentProxy.status.noProxyNode')}
          </TooltipContent>
        </Tooltip>
      }
      iconColor={currentProxy ? 'primary' : undefined}
      action={
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  ref={delayButtonRef}
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCheckDelay}
                  disabled={isDirectMode || unsortedProxyOptions.length === 0}
                  aria-label={t(
                    'home.components.currentProxy.actions.refreshDelay',
                  )}
                >
                  <GaugeIcon />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {t('home.components.currentProxy.actions.refreshDelay')}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleSortTypeChange}
                aria-label={getSortTooltip()}
              >
                {getSortIcon()}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{getSortTooltip()}</TooltipContent>
          </Tooltip>
          <Button variant="outline" size="sm" onClick={goToProxies}>
            {t('layout.components.navigation.tabs.proxies')}
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </div>
      }
    >
      {isCoreDataPending ? (
        <Skeleton className="h-16 w-full" />
      ) : currentProxy || (!isDirectMode && selectedGroup) ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 rounded-md border border-primary/10 bg-primary/5 p-2">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm font-medium">
                {currentProxy?.name ??
                  t('home.components.currentProxy.labels.noActiveNode')}
              </span>

              <div className="flex flex-wrap items-center gap-1">
                {currentProxy?.type && (
                  <span className="me-1 text-[0.625rem] text-muted-foreground">
                    {currentProxy.type}
                  </span>
                )}
                {isGlobalMode && (
                  <Badge>
                    {t('home.components.currentProxy.labels.globalMode')}
                  </Badge>
                )}
                {isDirectMode && (
                  <Badge className="bg-success/10 text-success">
                    {t('home.components.currentProxy.labels.directMode')}
                  </Badge>
                )}
                {currentProxy?.udp && <Badge variant="outline">UDP</Badge>}
                {currentProxy?.tfo && <Badge variant="outline">TFO</Badge>}
                {currentProxy?.xudp && <Badge variant="outline">XUDP</Badge>}
                {currentProxy?.mptcp && <Badge variant="outline">MPTCP</Badge>}
                {currentProxy?.smux && <Badge variant="outline">SMUX</Badge>}
              </div>
            </div>

            {currentProxy && !isDirectMode && (
              <DelayBadge delay={currentDelay} className="shrink-0" />
            )}
          </div>

          <PersistentSelect
            label={t('home.components.currentProxy.labels.group')}
            displayValue={
              <span className="block truncate">{selectedGroupName}</span>
            }
            open={openSelect === 'group'}
            disabled={isGlobalMode || isDirectMode}
            keepOpenRef={delayButtonRef}
            onOpenChange={(open) => setOpenSelect(open ? 'group' : null)}
            renderOptions={() =>
              selectableGroups.map((group) => (
                <PersistentOption
                  key={group.name}
                  selected={group.name === selectedGroupName}
                  onSelect={() => handleGroupChange(group.name)}
                >
                  <span className="truncate">{group.name}</span>
                </PersistentOption>
              ))
            }
          />

          <PersistentProxySelect
            label={t('home.components.currentProxy.labels.proxy')}
            groupName={selectedGroupName}
            fixed={selectedGroup?.fixed}
            value={
              currentOption
                ? optionValue(currentOption.memberIndex, currentOption.member)
                : ''
            }
            selectedName={selectedProxyName}
            selectedDelay={currentDelay}
            options={proxyOptions}
            open={openSelect === 'proxy'}
            disabled={isDirectMode}
            keepOpenRef={delayButtonRef}
            onOpenChange={(open) => setOpenSelect(open ? 'proxy' : null)}
            onChange={handleProxyChange}
          />
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          {t('home.components.currentProxy.labels.noActiveNode')}
        </div>
      )}
    </EnhancedCard>
  )
}
