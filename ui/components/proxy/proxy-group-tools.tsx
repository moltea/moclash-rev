import { useDebounceFn } from 'ahooks'
import {
  ArrowDownAZIcon,
  ArrowDownUpIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  GaugeIcon,
  LocateFixedIcon,
  SearchIcon,
  SearchXIcon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react'
import { type MouseEvent, type ReactNode, memo, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'

import type { ProxySortType } from '@/components/proxy/use-filter-sort'
import type { HeadState } from '@/components/proxy/use-head-state'
import { useVerge } from '@/hooks/use-verge'
import delayManager from '@/services/delay'
import { showNotice } from '@/services/notice-service'
import { isValidLatencyTestUrl } from '@/utils/network'
import { BaseSearchBox, type SearchState } from '@ui/components/base'
import { Button } from '@ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@ui/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

import { ProxyTestUrlInput } from './proxy-test-url-input'

const SORT_OPTIONS = [
  {
    value: 0,
    icon: ArrowDownUpIcon,
    label: 'proxies.page.tooltips.sortDefault',
  },
  { value: 1, icon: ClockIcon, label: 'proxies.page.tooltips.sortDelay' },
  { value: 2, icon: ArrowDownAZIcon, label: 'proxies.page.tooltips.sortName' },
] as const

const stopEvent = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

export const ProxyToolButton = ({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

export const ProxySortMenu = ({
  sortType,
  onSort,
}: {
  sortType: ProxySortType
  onSort: (sortType: ProxySortType) => void
}) => {
  const { t } = useTranslation()
  const current =
    SORT_OPTIONS.find((option) => option.value === sortType) ?? SORT_OPTIONS[0]
  const CurrentIcon = current.icon
  const currentLabel = t(current.label)

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={currentLabel}
              onClick={(e) => e.stopPropagation()}
            >
              <CurrentIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{currentLabel}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuRadioGroup
          value={String(sortType)}
          onValueChange={(value) => onSort(Number(value) as ProxySortType)}
        >
          {SORT_OPTIONS.map(({ value, icon: Icon, label }) => (
            <DropdownMenuRadioItem key={value} value={String(value)}>
              <Icon />
              {t(label)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface Props {
  className?: string
  side?: 'left' | 'right'
  url?: string
  groupName: string
  headState: HeadState
  onLocation: () => void
  onCheckDelay: () => void
  onHeadState: (val: Partial<HeadState>) => void
}

export const ProxyGroupTools = memo(function ProxyGroupTools(props: Props) {
  const {
    className,
    side = 'right',
    url,
    groupName,
    headState,
    onCheckDelay,
    onHeadState,
    onLocation,
  } = props

  const {
    showType,
    sortType,
    filterText,
    textState,
    testUrl,
    filterMatchCase,
    filterMatchWholeWord,
    filterUseRegularExpression,
  } = headState

  const { t } = useTranslation()

  const { verge } = useVerge()
  const defaultLatencyUrl =
    verge?.default_latency_test?.trim() ||
    'http://cp.cloudflare.com/generate_204'

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    delayManager.setUrl(
      groupName,
      testUrl?.trim() || url?.trim() || defaultLatencyUrl,
    )
  }, [groupName, testUrl, defaultLatencyUrl, url])

  const { run: applyFilter, flush: flushFilter } = useDebounceFn(
    (state: SearchState) => {
      onHeadState({
        filterText: state.text,
        filterMatchCase: state.matchCase,
        filterMatchWholeWord: state.matchWholeWord,
        filterUseRegularExpression: state.useRegularExpression,
      })
    },
    { wait: 600 },
  )

  useEffect(() => {
    if (textState !== 'filter') flushFilter()
  }, [textState, flushFilter])
  useEffect(() => () => flushFilter(), [flushFilter])

  const ensureOpen = () => {
    if (headState.open) return
    // eslint-disable-next-line @eslint-react/dom-no-flush-sync
    flushSync(() => onHeadState({ open: true }))
  }

  const textInput = (
    <>
      {textState === 'filter' && (
        <div className="min-w-0 flex-1">
          <BaseSearchBox
            inputRef={inputRef}
            defaultValue={filterText}
            matchCase={filterMatchCase}
            matchWholeWord={filterMatchWholeWord}
            useRegularExpression={filterUseRegularExpression}
            onClick={stopEvent}
            onSearch={(_, state) => applyFilter(state)}
          />
        </div>
      )}

      {textState === 'url' && (
        <ProxyTestUrlInput
          name={groupName}
          inputRef={inputRef}
          autoComplete="new-password"
          autoSave="off"
          value={testUrl}
          placeholder={t('proxies.page.placeholders.delayCheckUrl')}
          onClick={stopEvent}
          onCommit={(testUrl) => onHeadState({ testUrl })}
          className="min-w-0 flex-1"
        />
      )}
    </>
  )

  return (
    <div
      className={cn(
        'flex h-7 flex-1 items-center gap-0.5',
        side === 'left' ? 'justify-start' : 'ml-4 justify-end',
        className,
      )}
    >
      {side === 'right' && textInput}
      <ProxyToolButton
        label={t('proxies.page.tooltips.locate')}
        onClick={(e) => {
          stopEvent(e)
          ensureOpen()
          onLocation()
        }}
      >
        <LocateFixedIcon />
      </ProxyToolButton>

      <ProxyToolButton
        label={t('proxies.page.tooltips.delayCheck')}
        onClick={(e) => {
          stopEvent(e)
          ensureOpen()
          if (testUrl?.trim() && textState !== 'filter') {
            onHeadState({ textState: 'url' })
          }
          if (testUrl?.trim() && !isValidLatencyTestUrl(testUrl)) {
            showNotice.warning('proxies.feedback.warnings.invalidTestUrl')
            return
          }
          onCheckDelay()
        }}
      >
        <GaugeIcon />
      </ProxyToolButton>

      <ProxySortMenu
        sortType={sortType}
        onSort={(nextSortType) => {
          ensureOpen()
          onHeadState({ sortType: nextSortType })
        }}
      />

      <ProxyToolButton
        label={t('proxies.page.tooltips.delayCheckUrl')}
        onClick={(e) => {
          stopEvent(e)
          onHeadState({
            textState: textState === 'url' ? null : 'url',
          })
          setTimeout(() => inputRef.current?.focus())
        }}
      >
        {textState === 'url' ? <WifiIcon /> : <WifiOffIcon />}
      </ProxyToolButton>

      <ProxyToolButton
        label={
          showType
            ? t('proxies.page.tooltips.showBasic')
            : t('proxies.page.tooltips.showDetail')
        }
        onClick={(e) => {
          stopEvent(e)
          ensureOpen()
          onHeadState({ showType: !showType })
        }}
      >
        {showType ? <EyeIcon /> : <EyeOffIcon />}
      </ProxyToolButton>

      <ProxyToolButton
        label={t('proxies.page.tooltips.filter')}
        onClick={(e) => {
          stopEvent(e)
          if (textState !== 'filter') ensureOpen()
          onHeadState({ textState: textState === 'filter' ? null : 'filter' })
          setTimeout(() => inputRef.current?.focus())
        }}
      >
        {textState === 'filter' ? <SearchXIcon /> : <SearchIcon />}
      </ProxyToolButton>
      {side === 'left' && textInput}
    </div>
  )
})
