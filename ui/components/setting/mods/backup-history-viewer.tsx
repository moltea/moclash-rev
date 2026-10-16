import { save } from '@tauri-apps/plugin-dialog'
import { useLockFn } from 'ahooks'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  DownloadIcon,
  HistoryIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useVerge } from '@/hooks/use-verge'
import {
  deleteLocalBackup,
  deleteWebdavBackup,
  exportLocalBackup,
  listLocalBackup,
  listWebDavBackup,
  restartApp,
  restoreLocalBackup,
  restoreWebDavBackup,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import {
  buildWebdavSignature,
  getWebdavStatus,
  setWebdavStatus,
} from '@/services/webdav-status'
import { BaseDialog, BaseLoadingOverlay } from '@ui/components/base'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@ui/components/ui/alert-dialog'
import { Button } from '@ui/components/ui/button'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@ui/components/ui/pagination'
import { Spinner } from '@ui/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'

dayjs.extend(customParseFormat)
dayjs.extend(relativeTime)

const DATE_FORMAT = 'YYYY-MM-DD_HH-mm-ss'
const FILENAME_PATTERN = /\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/

type BackupSource = 'local' | 'webdav'
type PendingConfirmation = {
  action: 'delete' | 'restore'
  filename: string
  source: BackupSource
} | null

interface BackupHistoryViewerProps {
  open: boolean
  source: BackupSource
  page: number
  onSourceChange: (source: BackupSource) => void
  onPageChange: (page: number) => void
  onClose: () => void
}

interface BackupRow {
  filename: string
  platform: string
  backup_time: dayjs.Dayjs | null
  display_time: string
  sort_value: number
}

const RowAction = ({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string
  icon: typeof DownloadIcon
  disabled: boolean
  onClick: () => void
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

export const BackupHistoryViewer = ({
  open,
  source,
  page,
  onSourceChange,
  onPageChange,
  onClose,
}: BackupHistoryViewerProps) => {
  const { t } = useTranslation()
  const { verge } = useVerge()
  const [rows, setRows] = useState<BackupRow[]>([])
  const [loading, setLoading] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation>(null)
  const isLocal = source === 'local'
  const isWebDavConfigured = Boolean(
    verge?.webdav_url && verge?.webdav_username && verge?.webdav_password,
  )
  const webdavSignature = buildWebdavSignature(verge)
  const webdavStatus = getWebdavStatus(webdavSignature)
  const shouldSkipWebDav = !isLocal && !isWebDavConfigured
  const pageSize = 8
  const isBusy = loading || isRestoring || isRestarting || isConfirming

  const buildRow = useCallback(
    (item: ILocalBackupFile | IWebDavFile): BackupRow | null => {
      const { filename, last_modified } = item
      if (!filename.toLowerCase().endsWith('.zip')) return null

      const platform =
        (filename.includes('-') && filename.split('-')[0]) ||
        t('settings.modals.backup.history.unknownPlatform', {
          defaultValue: 'unknown',
        })
      const match = filename.match(FILENAME_PATTERN)
      const parsedFromName = match ? dayjs(match[0], DATE_FORMAT, true) : null
      const parsedFromModified =
        last_modified && dayjs(last_modified).isValid()
          ? dayjs(last_modified)
          : null
      const backupTime = parsedFromName?.isValid()
        ? parsedFromName
        : parsedFromModified

      return {
        filename,
        platform,
        backup_time: backupTime ?? null,
        display_time:
          backupTime?.format('YYYY-MM-DD HH:mm') ??
          parsedFromModified?.format('YYYY-MM-DD HH:mm') ??
          t('settings.modals.backup.history.unknownTime', {
            defaultValue: 'Unknown time',
          }),
        sort_value:
          backupTime?.valueOf() ??
          parsedFromModified?.valueOf() ??
          Number.NEGATIVE_INFINITY,
      }
    },
    [t],
  )

  const fetchRows = useCallback(
    async (options?: { force?: boolean }) => {
      if (!open) return
      if (shouldSkipWebDav) {
        setRows([])
        return
      }
      if (!isLocal && webdavStatus === 'failed' && !options?.force) {
        setRows([])
        return
      }

      setLoading(true)
      try {
        const list = isLocal
          ? await listLocalBackup()
          : await listWebDavBackup()
        if (!isLocal) {
          setWebdavStatus(webdavSignature, 'ready')
        }
        setRows(
          list
            .map((item) => buildRow(item))
            .filter((item): item is BackupRow => item !== null)
            .sort((a, b) =>
              a.sort_value === b.sort_value
                ? b.filename.localeCompare(a.filename)
                : b.sort_value - a.sort_value,
            ),
        )
      } catch (error) {
        if (!isLocal) {
          setWebdavStatus(webdavSignature, 'failed')
        }
        console.error(error)
        setRows([])
        showNotice.error(error)
      } finally {
        setLoading(false)
      }
    },
    [buildRow, isLocal, open, shouldSkipWebDav, webdavSignature, webdavStatus],
  )

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const pagedRows = rows.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize,
  )

  const summary = useMemo(() => {
    if (shouldSkipWebDav || (!isLocal && webdavStatus === 'failed')) {
      return t('settings.modals.backup.manual.webdav')
    }
    if (!total) return t('settings.modals.backup.history.empty')
    const recent =
      rows[0]?.backup_time?.fromNow() ?? rows[0]?.display_time ?? ''
    return t('settings.modals.backup.history.summary', {
      count: total,
      recent,
    })
  }, [isLocal, rows, shouldSkipWebDav, t, total, webdavStatus])

  const handleDelete = (filename: string) => {
    if (isRestarting) return
    setPendingConfirmation({ action: 'delete', filename, source })
  }

  const handleRestore = (filename: string) => {
    if (isRestoring || isRestarting) return
    setPendingConfirmation({ action: 'restore', filename, source })
  }

  const handleConfirmAction = useLockFn(async () => {
    if (!pendingConfirmation) return
    const { action, filename, source: actionSource } = pendingConfirmation
    const actionIsLocal = actionSource === 'local'
    setIsConfirming(true)
    if (action === 'restore') {
      setIsRestoring(true)
    }
    try {
      if (action === 'delete') {
        if (actionIsLocal) {
          await mutate(() => deleteLocalBackup(filename), {
            id: 'delete-local-backup',
            errorNotice: false,
          })
        } else {
          await mutate(() => deleteWebdavBackup(filename), {
            id: 'delete-webdav-backup',
            errorNotice: false,
          })
        }
        setPendingConfirmation(null)
        await fetchRows()
      } else {
        if (actionIsLocal) {
          await mutate(() => restoreLocalBackup(filename), {
            id: 'restore-local-backup',
            errorNotice: false,
          })
        } else {
          await mutate(() => restoreWebDavBackup(filename), {
            id: 'restore-webdav-backup',
            errorNotice: false,
          })
        }
        setPendingConfirmation(null)
        showNotice.success('settings.modals.backup.messages.restoreSuccess')
        setIsRestarting(true)
        window.setTimeout(() => {
          void mutate(() => restartApp(), {
            id: 'restart-app',
            errorNotice: false,
          }).catch((err: unknown) => {
            setIsRestarting(false)
            showNotice.error(err)
          })
        }, 1000)
      }
    } catch (error) {
      console.error(error)
      showNotice.error(error)
    } finally {
      setIsConfirming(false)
      setIsRestoring(false)
    }
  })

  const handleExport = useLockFn(async (filename: string) => {
    if (isRestarting) return
    if (!isLocal) return
    const savePath = await save({ defaultPath: filename })
    if (!savePath || Array.isArray(savePath)) return
    try {
      await mutate(() => exportLocalBackup(filename, savePath), {
        id: 'export-local-backup',
        errorNotice: false,
        successNotice: 'settings.modals.backup.messages.localBackupExported',
      })
    } catch (ignoreError: unknown) {
      showNotice.error(
        'settings.modals.backup.messages.localBackupExportFailed',
      )
    }
  })

  const handleRefresh = () => {
    if (isRestarting) return
    void fetchRows({ force: true })
  }

  const closeConfirmDialog = () => {
    if (isConfirming) return
    setPendingConfirmation(null)
  }

  const confirmTitle =
    pendingConfirmation?.action === 'delete'
      ? t('settings.modals.backup.actions.deleteBackup')
      : t('settings.modals.backup.actions.restoreBackup')
  const confirmMessage =
    pendingConfirmation?.action === 'delete'
      ? t('settings.modals.backup.messages.confirmDelete')
      : t('settings.modals.backup.messages.confirmRestore')

  return (
    <BaseDialog
      open={open}
      title={t('settings.modals.backup.history.title')}
      className="sm:max-w-xl"
      disableOk
      cancelBtn={t('shared.actions.close')}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="relative flex min-h-80 flex-col gap-3">
        <BaseLoadingOverlay isLoading={isBusy} />
        <div className="flex items-center justify-between gap-2">
          <Tabs
            value={source}
            onValueChange={(val) => {
              if (isBusy) return
              onSourceChange(val as BackupSource)
              onPageChange(0)
            }}
          >
            <TabsList>
              <TabsTrigger value="local" disabled={isBusy}>
                {t('settings.modals.backup.tabs.local')}
              </TabsTrigger>
              <TabsTrigger value="webdav" disabled={isBusy}>
                {t('settings.modals.backup.tabs.webdav')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('shared.actions.refresh')}
                disabled={isBusy}
                onClick={handleRefresh}
              >
                <RefreshCwIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('shared.actions.refresh')}</TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground">{summary}</p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {t('settings.modals.backup.table.filename')}
              </TableHead>
              <TableHead>
                {t('settings.modals.backup.table.backupTime')}
              </TableHead>
              <TableHead className="text-end">
                {t('settings.modals.backup.table.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-20 text-center text-muted-foreground"
                >
                  {t('settings.modals.backup.history.empty') || ''}
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row) => (
                <TableRow key={`${row.platform}-${row.filename}`}>
                  <TableCell className="font-medium break-all whitespace-normal">
                    {row.filename}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {`${row.platform} · ${row.display_time}`}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      {isLocal && (
                        <RowAction
                          label={t('settings.modals.backup.actions.export')}
                          icon={DownloadIcon}
                          disabled={isBusy}
                          onClick={() => handleExport(row.filename)}
                        />
                      )}
                      <RowAction
                        label={t('settings.modals.backup.actions.deleteBackup')}
                        icon={Trash2Icon}
                        disabled={isBusy}
                        onClick={() => handleDelete(row.filename)}
                      />
                      <RowAction
                        label={t(
                          'settings.modals.backup.actions.restoreBackup',
                        )}
                        icon={HistoryIcon}
                        disabled={isBusy}
                        onClick={() => handleRestore(row.filename)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {pageCount > 1 && (
          <Pagination className="justify-end">
            <PaginationContent className="gap-1">
              <PaginationItem className="px-1 text-xs text-muted-foreground tabular-nums">
                {currentPage + 1} / {pageCount}
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isBusy || currentPage === 0}
                  onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                >
                  {t('shared.actions.previous')}
                </Button>
              </PaginationItem>
              <PaginationItem>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isBusy || currentPage >= pageCount - 1}
                  onClick={() =>
                    onPageChange(Math.min(pageCount - 1, currentPage + 1))
                  }
                >
                  {t('shared.actions.next')}
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
      <AlertDialog
        open={pendingConfirmation !== null}
        onOpenChange={(next) => {
          if (!next) closeConfirmDialog()
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription className="wrap-break-word">
              {confirmMessage}
            </AlertDialogDescription>
            {pendingConfirmation?.filename && (
              <p className="text-xs break-all text-muted-foreground">
                {pendingConfirmation.filename}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>
              {t('shared.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={
                pendingConfirmation?.action === 'delete'
                  ? 'destructive'
                  : 'default'
              }
              disabled={isConfirming}
              onClick={(e) => {
                e.preventDefault()
                handleConfirmAction()
              }}
            >
              {isConfirming && <Spinner data-icon="inline-start" />}
              {t('shared.actions.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BaseDialog>
  )
}
