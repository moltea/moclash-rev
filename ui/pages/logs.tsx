import {
  ArrowUpDownIcon,
  CirclePauseIcon,
  CirclePlayIcon,
  Trash2Icon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useClashLog } from '@/hooks/use-clash-log'
import { useLogData } from '@/hooks/use-log-data'
import {
  BaseEmpty,
  BasePage,
  BaseSearchBox,
  type SearchState,
  VirtualList,
  type VirtualListHandle,
} from '@ui/components/base'
import LogItem from '@ui/components/log/log-item'
import { Button } from '@ui/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

const HeaderAction = ({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

const LogPage = () => {
  const { t } = useTranslation()
  const [clashLog, setClashLog] = useClashLog()
  const enableLog = clashLog.enable
  const logState = clashLog.logFilter
  const logOrder = clashLog.logOrder ?? 'asc'
  const isDescending = logOrder === 'desc'

  const [match, setMatch] = useState(() => (_: string) => true)
  const [searchState, setSearchState] = useState<SearchState>()
  const {
    response: { data: logData },
    refreshGetClashLog,
  } = useLogData()

  const filterLogs = useMemo(() => {
    if (!logData || logData.length === 0) {
      return []
    }

    return logData.filter((data) => {
      const searchText =
        `${data.time || ''} ${data.type} ${data.payload}`.toLowerCase()

      const matchesSearch = match(searchText)

      return (
        (logState == 'all' ? true : data.type.includes(logState)) &&
        matchesSearch
      )
    })
  }, [logData, logState, match])

  const filteredLogs = useMemo(
    () => (isDescending ? [...filterLogs].reverse() : filterLogs),
    [filterLogs, isDescending],
  )

  const scrollRef = useRef({ isNearBottom: true })
  const virtuosoRef = useRef<VirtualListHandle>(null)

  useEffect(() => {
    if (!isDescending && scrollRef.current.isNearBottom) {
      virtuosoRef.current?.scrollToIndex(filteredLogs.length - 1, {
        behavior: 'smooth',
      })
    }
  }, [isDescending, filteredLogs.length])

  const handleLogLevelChange = (newLevel: LogFilter) => {
    setClashLog((pre) => ({ ...pre!, logFilter: newLevel }))
  }

  const handleToggleLog = async () => {
    setClashLog((pre) => ({ ...pre!, enable: !enableLog }))
  }

  const handleToggleOrder = () => {
    setClashLog((pre) => ({
      ...pre!,
      logOrder: pre!.logOrder === 'desc' ? 'asc' : 'desc',
    }))
  }

  return (
    <BasePage
      full
      title={t('logs.page.title')}
      contentClassName="flex flex-col"
      header={
        <>
          <HeaderAction
            label={t(
              enableLog ? 'shared.actions.pause' : 'shared.actions.resume',
            )}
            onClick={handleToggleLog}
          >
            {enableLog ? <CirclePauseIcon /> : <CirclePlayIcon />}
          </HeaderAction>
          <HeaderAction
            label={t(
              isDescending
                ? 'logs.actions.showAscending'
                : 'logs.actions.showDescending',
            )}
            onClick={handleToggleOrder}
          >
            <ArrowUpDownIcon
              className={cn(
                'transition-transform duration-200',
                isDescending && '-scale-y-100',
              )}
            />
          </HeaderAction>
          <HeaderAction
            label={t('shared.actions.clear')}
            onClick={() => {
              refreshGetClashLog(true)
            }}
          >
            <Trash2Icon />
          </HeaderAction>
        </>
      }
    >
      <div className="flex h-11 shrink-0 items-center gap-2 px-2.5 py-2">
        <Select
          value={logState}
          onValueChange={(value) => handleLogLevelChange(value as LogFilter)}
        >
          <SelectTrigger size="sm" className="shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('shared.filters.logLevels.all')}
            </SelectItem>
            <SelectItem value="debug">
              {t('shared.filters.logLevels.debug')}
            </SelectItem>
            <SelectItem value="info">
              {t('shared.filters.logLevels.info')}
            </SelectItem>
            <SelectItem value="warn">
              {t('shared.filters.logLevels.warn')}
            </SelectItem>
            <SelectItem value="err">
              {t('shared.filters.logLevels.error')}
            </SelectItem>
          </SelectContent>
        </Select>
        <BaseSearchBox
          className="min-w-0 flex-1"
          onSearch={(matcher, state) => {
            setMatch(() => matcher)
            setSearchState(state)
          }}
        />
      </div>

      {filteredLogs.length > 0 ? (
        <VirtualList
          ref={virtuosoRef}
          count={filteredLogs.length}
          estimateSize={50}
          renderItem={(i) => (
            <LogItem value={filteredLogs[i]} searchState={searchState} />
          )}
          onScroll={(event) => {
            const element = event.currentTarget as HTMLDivElement
            scrollRef.current.isNearBottom =
              element.scrollHeight - element.scrollTop - element.clientHeight <=
              20
          }}
          style={{ flex: 1 }}
        />
      ) : (
        <BaseEmpty />
      )}
    </BasePage>
  )
}

export default LogPage
