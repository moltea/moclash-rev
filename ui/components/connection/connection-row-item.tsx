import { useLockFn } from 'ahooks'
import { XIcon } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { closeConnection } from 'tauri-plugin-mihomo-api'

import { RelativeTime } from '@/components/connection/connection-relative-time'
import type { ConnectionRowView } from '@/components/connection/connection-row-view'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'

interface Props {
  row: ConnectionRowView
  closed: boolean
  onShowDetail: (id: string) => void
}

const tagClassName = 'max-w-full justify-start truncate text-muted-foreground'

export const ConnectionRowItem = memo(
  function ConnectionRowItem({ row, closed, onShowDetail }: Props) {
    const { t } = useTranslation()
    const onDelete = useLockFn(async () => closeConnection(row.id))
    const handleShowDetail = useCallback(
      () => onShowDetail(row.id),
      [onShowDetail, row.id],
    )
    const showTraffic = row.uploadSpeed >= 100 || row.downloadSpeed >= 100

    return (
      <div className="relative flex min-h-14 items-center gap-2 overflow-hidden border-b py-1.5 ps-3 pe-12 transition-colors hover:bg-muted/50">
        <div
          className="min-w-0 flex-1 cursor-pointer select-text"
          onClick={handleShowDetail}
        >
          <div className="truncate text-xs font-medium">{row.host}</div>
          <div className="mt-1 flex flex-wrap gap-1 overflow-hidden">
            <Badge variant="outline" className={tagClassName}>
              {row.network}
            </Badge>
            <Badge variant="outline" className={tagClassName}>
              {row.type}
            </Badge>
            {row.process && (
              <Badge variant="outline" className={tagClassName}>
                {row.process}
              </Badge>
            )}
            {row.chains && (
              <Badge variant="outline" className={tagClassName}>
                {row.chains}
              </Badge>
            )}
            <Badge variant="outline" className={tagClassName}>
              <RelativeTime start={row.time} />
            </Badge>
            {showTraffic && (
              <Badge variant="outline" className={tagClassName}>
                {row.uploadSpeedText} / {row.downloadSpeedText}
              </Badge>
            )}
          </div>
        </div>
        {!closed && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute end-2 top-1/2 -translate-y-1/2"
            onClick={onDelete}
            title={t('connections.components.actions.closeConnection')}
            aria-label={t('connections.components.actions.closeConnection')}
          >
            <XIcon />
          </Button>
        )}
      </div>
    )
  },
  (prev, next) =>
    prev.row === next.row &&
    prev.closed === next.closed &&
    prev.onShowDetail === next.onShowDetail,
)
