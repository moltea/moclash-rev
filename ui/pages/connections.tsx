import { useLockFn } from 'ahooks'
import {
  Columns3Icon,
  ListIcon,
  TableIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { closeAllConnections } from 'tauri-plugin-mihomo-api'

import {
  getConnectionStartTime,
  useConnectionRowViews,
} from '@/components/connection/connection-row-view'
import { useConnectionData } from '@/hooks/use-connection-data'
import { useConnectionSetting } from '@/hooks/use-connection-setting'
import { useTrafficData } from '@/hooks/use-traffic-data'
import { useVisibility } from '@/hooks/use-visibility'
import { mutate } from '@/services/mutate'
import parseTraffic from '@/utils/parse-traffic'
import {
  BaseEmpty,
  BasePage,
  BaseSearchBox,
  type SearchState,
  VirtualList,
} from '@ui/components/base'
import {
  ConnectionDetail,
  type ConnectionDetailRef,
} from '@ui/components/connection/connection-detail'
import { ConnectionRowItem } from '@ui/components/connection/connection-row-item'
import { ConnectionTable } from '@ui/components/connection/connection-table'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@ui/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

type OrderFunc = (list: IConnectionsItem[]) => IConnectionsItem[]

const ORDER_OPTIONS = [
  {
    id: 'default',
    labelKey: 'connections.components.order.default',
    fn: (list: IConnectionsItem[]) =>
      list.sort(
        (a, b) => getConnectionStartTime(b) - getConnectionStartTime(a),
      ),
  },
  {
    id: 'uploadSpeed',
    labelKey: 'connections.components.order.uploadSpeed',
    fn: (list: IConnectionsItem[]) =>
      list.sort((a, b) => (b.curUpload ?? 0) - (a.curUpload ?? 0)),
  },
  {
    id: 'downloadSpeed',
    labelKey: 'connections.components.order.downloadSpeed',
    fn: (list: IConnectionsItem[]) =>
      list.sort((a, b) => (b.curDownload ?? 0) - (a.curDownload ?? 0)),
  },
] as const

type OrderKey = (typeof ORDER_OPTIONS)[number]['id']

const orderFunctionMap = ORDER_OPTIONS.reduce<Record<OrderKey, OrderFunc>>(
  (acc, option) => {
    acc[option.id] = option.fn
    return acc
  },
  {} as Record<OrderKey, OrderFunc>,
)

const EMPTY_CONNECTIONS: IConnectionsItem[] = []
const ConnectionsPage = () => {
  const { t } = useTranslation()
  const pageVisible = useVisibility()
  const [match, setMatch] = useState<(input: string) => boolean>(
    () => () => true,
  )
  const [hasSearch, setHasSearch] = useState(false)
  const [curOrderOpt, setCurOrderOpt] = useState<OrderKey>('default')
  const [connectionsType, setConnectionsType] = useState<'active' | 'closed'>(
    'active',
  )

  const {
    response: { data: connections },
    clearClosedConnections,
  } = useConnectionData({ enabled: pageVisible })
  const {
    response: { data: traffic },
  } = useTrafficData({ enabled: pageVisible })

  const [setting, setSetting] = useConnectionSetting()

  const isTableLayout = setting.layout === 'table'

  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false)

  const selectedConnections =
    connectionsType === 'active'
      ? (connections?.activeConnections ?? EMPTY_CONNECTIONS)
      : (connections?.closedConnections ?? EMPTY_CONNECTIONS)

  const filterConn = useMemo(() => {
    const orderFunc = orderFunctionMap[curOrderOpt]

    if (isTableLayout && !hasSearch) return selectedConnections
    if (!hasSearch) return orderFunc([...selectedConnections])

    const matchConns = selectedConnections.filter((conn) => {
      const { host, destinationIP, process } = conn.metadata
      return (
        match(host || '') || match(destinationIP || '') || match(process || '')
      )
    })

    return orderFunc ? orderFunc(matchConns) : matchConns
  }, [selectedConnections, isTableLayout, hasSearch, match, curOrderOpt])

  const displayRows = useConnectionRowViews(
    isTableLayout ? EMPTY_CONNECTIONS : filterConn,
  )

  const detailRef = useRef<ConnectionDetailRef>(null!)

  const selectConnectionsType = useCallback(
    (type: 'active' | 'closed') => {
      if (type === connectionsType) return
      detailRef.current?.close()
      setIsColumnManagerOpen(false)
      setConnectionsType(type)
    },
    [connectionsType],
  )

  const showDetailById = useCallback(
    (id: string) => {
      const connection = filterConn.find((item) => item.id === id)
      if (connection) {
        detailRef.current?.open(connection, connectionsType === 'closed')
      }
    },
    [connectionsType, filterConn],
  )

  const onCloseAll = useLockFn(() =>
    mutate(() => closeAllConnections(), {
      id: 'close-all-connections',
      errorNotice: false,
    }),
  )

  const handleSearch = useCallback(
    (match: (content: string) => boolean, state: SearchState) => {
      setMatch(() => match)
      setHasSearch(state.text.length > 0)
    },
    [],
  )
  const hasTableData = filterConn.length > 0
  const layoutLabel = isTableLayout
    ? t('shared.actions.listView')
    : t('shared.actions.tableView')

  return (
    <BasePage
      full
      title={t('connections.page.title')}
      contentClassName="flex flex-col"
      header={
        <>
          <div className="flex items-center gap-3 px-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums @max-3xl/page-header:hidden">
            <span>
              {t('shared.labels.downloaded')}:{' '}
              <span className="text-foreground">
                {parseTraffic(traffic?.downTotal || 0)}
              </span>
            </span>
            <span>
              {t('shared.labels.uploaded')}:{' '}
              <span className="text-foreground">
                {parseTraffic(traffic?.upTotal || 0)}
              </span>
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={layoutLabel}
                onClick={() =>
                  setSetting((o) =>
                    o?.layout !== 'table'
                      ? { ...o, layout: 'table' }
                      : { ...o, layout: 'list' },
                  )
                }
              >
                {isTableLayout ? <ListIcon /> : <TableIcon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{layoutLabel}</TooltipContent>
          </Tooltip>
          <Button
            size="sm"
            title={t('shared.actions.closeAll')}
            onClick={onCloseAll}
          >
            <XIcon data-icon="inline-start" />
            <span className="@max-2xl/page-header:hidden">
              {t('shared.actions.closeAll')}
            </span>
          </Button>
        </>
      }
    >
      <div className="sticky top-0 z-20 flex min-h-11 shrink-0 items-center gap-2 px-2.5 py-2 select-text">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={connectionsType}
          onValueChange={(value) => {
            if (value) selectConnectionsType(value as 'active' | 'closed')
          }}
        >
          <ToggleGroupItem value="active">
            {t('connections.components.actions.active')}
            <Badge variant="secondary" className="tabular-nums">
              {connections?.activeConnections.length}
            </Badge>
          </ToggleGroupItem>
          <ToggleGroupItem value="closed">
            {t('connections.components.actions.closed')}
            <Badge variant="secondary" className="tabular-nums">
              {connections?.closedConnections.length}
            </Badge>
          </ToggleGroupItem>
        </ToggleGroup>
        {!isTableLayout && (
          <Select
            value={curOrderOpt}
            onValueChange={(value) => setCurOrderOpt(value as OrderKey)}
          >
            <SelectTrigger size="sm" className="shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORDER_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <BaseSearchBox className="min-w-0 flex-1" onSearch={handleSearch} />
        {isTableLayout && hasTableData && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                aria-label={t('connections.components.columnManager.title')}
                onClick={() => setIsColumnManagerOpen(true)}
              >
                <Columns3Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('connections.components.columnManager.title')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {!hasTableData ? (
        <BaseEmpty />
      ) : isTableLayout ? (
        <ConnectionTable
          connections={filterConn}
          onShowDetail={showDetailById}
          columnManagerOpen={isColumnManagerOpen}
          onCloseColumnManager={() => setIsColumnManagerOpen(false)}
        />
      ) : (
        <VirtualList
          key={connectionsType}
          count={displayRows.length}
          estimateSize={56}
          renderItem={(i) => (
            <ConnectionRowItem
              row={displayRows[i]}
              closed={connectionsType === 'closed'}
              onShowDetail={showDetailById}
            />
          )}
          style={{
            flex: 1,
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        />
      )}
      <ConnectionDetail ref={detailRef} />
      {connectionsType === 'closed' && filterConn.length > 0 && (
        <Button
          className={cn(
            'absolute end-4 z-20 shadow-md animate-in zoom-in-50 fade-in-0',
            isTableLayout ? 'bottom-[70px]' : 'bottom-4',
          )}
          onClick={() => clearClosedConnections()}
        >
          <Trash2Icon data-icon="inline-start" />
          {t('shared.actions.clear')}
        </Button>
      )}
    </BasePage>
  )
}

export default ConnectionsPage
