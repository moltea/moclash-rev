import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { useLockFn } from 'ahooks'
import type { ReactNode, Ref } from 'react'
import { Fragment, useCallback, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useVerge } from '@/hooks/use-verge'
import {
  createLocalBackup,
  createWebdavBackup,
  importLocalBackup,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { errorDetail, showNotice } from '@/services/notice-service'
import { buildWebdavSignature, setWebdavStatus } from '@/services/webdav-status'
import { BaseDialog, BaseFieldset, type DialogRef } from '@ui/components/base'
import { Button } from '@ui/components/ui/button'
import { Separator } from '@ui/components/ui/separator'
import { Spinner } from '@ui/components/ui/spinner'

import { AutoBackupSettings } from './auto-backup-settings'
import { BackupHistoryViewer } from './backup-history-viewer'
import { BackupWebdavDialog } from './backup-webdav-dialog'

type BackupSource = 'local' | 'webdav'

export function BackupViewer({ ref }: { ref?: Ref<DialogRef> }) {
  const { t } = useTranslation()
  const { verge } = useVerge()
  const [open, setOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<BackupSource | null>(null)
  const [localImporting, setLocalImporting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySource, setHistorySource] = useState<BackupSource>('local')
  const [historyPage, setHistoryPage] = useState(0)
  const [webdavDialogOpen, setWebdavDialogOpen] = useState(false)
  const webdavSignature = buildWebdavSignature(verge)

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }))

  const openHistory = (target: BackupSource) => {
    setHistorySource(target)
    setHistoryPage(0)
    setHistoryOpen(true)
  }

  const handleBackup = useLockFn(async (target: BackupSource) => {
    try {
      setBusyAction(target)
      if (target === 'local') {
        await mutate(() => createLocalBackup(), {
          id: 'create-local-backup',
          errorNotice: false,
          successNotice: 'settings.modals.backup.messages.localBackupCreated',
        })
      } else {
        await mutate(() => createWebdavBackup(), {
          id: 'create-webdav-backup',
          errorNotice: false,
          successNotice: 'settings.modals.backup.messages.backupCreated',
          onFulfilled: () => setWebdavStatus(webdavSignature, 'ready'),
        })
      }
    } catch (error) {
      console.error(error)
      showNotice.error(
        target === 'local'
          ? 'settings.modals.backup.messages.localBackupFailed'
          : 'settings.modals.backup.messages.backupFailed',
        target === 'local' ? undefined : { error: errorDetail(error) },
      )
      if (target === 'webdav') {
        setWebdavStatus(webdavSignature, 'failed')
      }
    } finally {
      setBusyAction(null)
    }
  })

  const handleImport = useLockFn(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'Backup File', extensions: ['zip'] }],
    })
    if (!selected || Array.isArray(selected)) return
    try {
      setLocalImporting(true)
      await mutate(() => importLocalBackup(selected), {
        id: 'import-local-backup',
        errorNotice: false,
        successNotice: 'settings.modals.backup.messages.localBackupImported',
      })
      openHistory('local')
    } catch (error) {
      console.error(error)
      showNotice.error(
        'settings.modals.backup.messages.localBackupImportFailed',
        { error: errorDetail(error) },
      )
    } finally {
      setLocalImporting(false)
    }
  })

  const setWebdavBusy = useCallback(
    (loading: boolean) => {
      setBusyAction(loading ? 'webdav' : null)
    },
    [setBusyAction],
  )

  const isLocalBusy = busyAction === 'local' || localImporting

  const manualItems = [
    {
      key: 'local' as BackupSource,
      title: t('settings.modals.backup.tabs.local'),
      description: t('settings.modals.backup.manual.local'),
      actions: [
        <Button
          key="backup"
          size="sm"
          disabled={busyAction === 'local' || localImporting}
          onClick={() => handleBackup('local')}
        >
          {busyAction === 'local' && <Spinner data-icon="inline-start" />}
          {t('settings.modals.backup.actions.backup')}
        </Button>,
        <Button
          key="history"
          variant="outline"
          size="sm"
          disabled={isLocalBusy}
          onClick={() => openHistory('local')}
        >
          {t('settings.modals.backup.actions.viewHistory')}
        </Button>,
        <Button
          key="import"
          variant="ghost"
          size="sm"
          disabled={localImporting || busyAction === 'local'}
          onClick={() => handleImport()}
        >
          {localImporting && <Spinner data-icon="inline-start" />}
          {t('settings.modals.backup.actions.importBackup')}
        </Button>,
      ],
    },
    {
      key: 'webdav' as BackupSource,
      title: t('settings.modals.backup.tabs.webdav'),
      description: t('settings.modals.backup.manual.webdav'),
      actions: [
        <Button
          key="backup"
          size="sm"
          disabled={busyAction === 'webdav'}
          onClick={() => handleBackup('webdav')}
        >
          {busyAction === 'webdav' && <Spinner data-icon="inline-start" />}
          {t('settings.modals.backup.actions.backup')}
        </Button>,
        <Button
          key="history"
          variant="outline"
          size="sm"
          onClick={() => openHistory('webdav')}
        >
          {t('settings.modals.backup.actions.viewHistory')}
        </Button>,
        <Button
          key="configure"
          variant="ghost"
          size="sm"
          onClick={() => setWebdavDialogOpen(true)}
        >
          {t('settings.modals.backup.manual.configureWebdav')}
        </Button>,
      ],
    },
  ] satisfies Array<{
    key: BackupSource
    title: string
    description: string
    actions: ReactNode[]
  }>

  return (
    <BaseDialog
      open={open}
      title={t('settings.modals.backup.title')}
      className="sm:max-w-xl"
      disableOk
      cancelBtn={t('shared.actions.close')}
      onCancel={() => setOpen(false)}
      onClose={() => setOpen(false)}
    >
      <div className="flex flex-col gap-4 py-1">
        <BaseFieldset label={t('settings.modals.backup.auto.title')}>
          <AutoBackupSettings />
        </BaseFieldset>

        <BaseFieldset label={t('settings.modals.backup.manual.title')}>
          <div className="flex flex-col gap-3">
            {manualItems.map((item, idx) => (
              <Fragment key={item.key}>
                {idx > 0 && <Separator />}
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.actions}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
        </BaseFieldset>
      </div>

      <BackupHistoryViewer
        open={historyOpen}
        source={historySource}
        page={historyPage}
        onSourceChange={setHistorySource}
        onPageChange={setHistoryPage}
        onClose={() => setHistoryOpen(false)}
      />
      <BackupWebdavDialog
        open={webdavDialogOpen}
        onClose={() => setWebdavDialogOpen(false)}
        onBackupSuccess={() => openHistory('webdav')}
        setBusy={setWebdavBusy}
      />
    </BaseDialog>
  )
}
