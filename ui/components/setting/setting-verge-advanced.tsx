import { CopyIcon, FingerprintIcon } from 'lucide-react'
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { GuardState } from '@/components/setting/mods/guard-state'
import { updateLastCheckTime } from '@/hooks/use-update'
import { useVerge } from '@/hooks/use-verge'
import {
  exitApp,
  exportDiagnosticInfo,
  openAppDir,
  openCoreDir,
  openDevTools,
  openLogsDir,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { checkUpdateSafe as checkUpdate } from '@/services/update'
import { version } from '@root/package.json'
import { type DialogRef, TooltipIcon } from '@ui/components/base'
import { BackupViewer } from '@ui/components/setting/mods/backup-viewer'
import { ConfigViewer } from '@ui/components/setting/mods/config-viewer'
import { HotkeyViewer } from '@ui/components/setting/mods/hotkey-viewer'
import { HwidViewer } from '@ui/components/setting/mods/hwid-viewer'
import { LayoutViewer } from '@ui/components/setting/mods/layout-viewer'
import { LiteModeViewer } from '@ui/components/setting/mods/lite-mode-viewer'
import { MiscViewer } from '@ui/components/setting/mods/misc-viewer'
import {
  SettingItem,
  SettingList,
} from '@ui/components/setting/mods/setting-comp'
import { ThemeViewer } from '@ui/components/setting/mods/theme-viewer'
import { UpdateViewer } from '@ui/components/setting/mods/update-viewer'
import { Switch } from '@ui/components/ui/switch'

interface Props {
  onError?: (err: Error) => void
}

const SettingVergeAdvanced = ({ onError: _ }: Props) => {
  const { t } = useTranslation()

  const configRef = useRef<DialogRef>(null)
  const hotkeyRef = useRef<DialogRef>(null)
  const miscRef = useRef<DialogRef>(null)
  const themeRef = useRef<DialogRef>(null)
  const layoutRef = useRef<DialogRef>(null)
  const updateRef = useRef<DialogRef>(null)
  const backupRef = useRef<DialogRef>(null)
  const liteModeRef = useRef<DialogRef>(null)
  const hwidRef = useRef<DialogRef>(null)
  const { verge, mutateVerge, patchVerge } = useVerge()

  const onCheckUpdate = async () => {
    try {
      const info = await checkUpdate()
      updateLastCheckTime()
      if (!info?.available) {
        showNotice.success(
          'settings.components.verge.advanced.notifications.latestVersion',
        )
      } else {
        updateRef.current?.open()
      }
    } catch (err) {
      console.warn('update check failed:', err)
      showNotice.warning(err)
    }
  }

  const onExportDiagnosticInfo = useCallback(async () => {
    await mutate(() => exportDiagnosticInfo(), {
      id: 'export-diagnostic-info',
      errorNotice: false,
    })
    showNotice.success('shared.feedback.notifications.common.copySuccess', 1000)
  }, [])

  const copyVersion = useCallback(() => {
    navigator.clipboard.writeText(`v${version}`).then(() => {
      showNotice.success(
        'settings.components.verge.advanced.notifications.versionCopied',
        1000,
      )
    })
  }, [])

  return (
    <SettingList title={t('settings.components.verge.advanced.title')}>
      <ThemeViewer ref={themeRef} />
      <ConfigViewer ref={configRef} />
      <HotkeyViewer ref={hotkeyRef} />
      <MiscViewer ref={miscRef} />
      <LayoutViewer ref={layoutRef} />
      <UpdateViewer ref={updateRef} />
      <BackupViewer ref={backupRef} />
      <LiteModeViewer ref={liteModeRef} />
      <HwidViewer ref={hwidRef} />

      <SettingItem
        onClick={() => backupRef.current?.open()}
        label={t('settings.components.verge.advanced.fields.backupSetting')}
        extra={
          <TooltipIcon
            title={t('settings.components.verge.advanced.tooltips.backupInfo')}
          />
        }
      />

      <SettingItem
        onClick={() => configRef.current?.open()}
        label={t('settings.components.verge.advanced.fields.runtimeConfig')}
      />

      <SettingItem
        onClick={openAppDir}
        label={t('settings.components.verge.advanced.fields.openConfDir')}
        extra={
          <TooltipIcon
            title={t('settings.components.verge.advanced.tooltips.openConfDir')}
          />
        }
      />

      <SettingItem
        onClick={openCoreDir}
        label={t('settings.components.verge.advanced.fields.openCoreDir')}
      />

      <SettingItem
        onClick={openLogsDir}
        label={t('settings.components.verge.advanced.fields.openLogsDir')}
      />

      <SettingItem
        onClick={onCheckUpdate}
        label={t('settings.components.verge.advanced.fields.checkUpdates')}
      />

      <SettingItem
        onClick={() => {
          void mutate(() => openDevTools(), {
            id: 'open-devtools',
            errorNotice: false,
          }).catch(() => {})
        }}
        label={t('settings.components.verge.advanced.fields.openDevTools')}
      />

      <SettingItem
        label={t('settings.components.verge.advanced.fields.liteModeSettings')}
        extra={
          <TooltipIcon
            title={t('settings.components.verge.advanced.tooltips.liteMode')}
          />
        }
        onClick={() => liteModeRef.current?.open()}
      />

      <SettingItem
        onClick={() => {
          void mutate(() => exitApp(), {
            id: 'exit-app',
            errorNotice: false,
          }).catch(() => {})
        }}
        label={t('settings.components.verge.advanced.fields.exit')}
      />

      <SettingItem
        label={t('settings.components.verge.advanced.fields.exportDiagnostics')}
        extra={<TooltipIcon icon={CopyIcon} onClick={onExportDiagnosticInfo} />}
      />

      <SettingItem
        label={t('settings.sections.hwid.fields.sendHwid')}
        secondary={t('settings.sections.hwid.tooltips.sendHwid')}
        extra={
          <TooltipIcon
            icon={FingerprintIcon}
            title={t('settings.sections.hwid.title')}
            onClick={() => hwidRef.current?.open()}
          />
        }
      >
        <GuardState
          value={verge?.enable_send_hwid ?? false}
          valueProps="checked"
          onChangeProps="onCheckedChange"
          onCatch={showNotice.error}
          onChange={(e) =>
            mutateVerge((prev) =>
              prev ? { ...prev, enable_send_hwid: e } : prev,
            )
          }
          onGuard={(e) => patchVerge({ enable_send_hwid: e })}
        >
          <Switch />
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t('settings.components.verge.advanced.fields.vergeVersion')}
        extra={
          <TooltipIcon
            icon={CopyIcon}
            onClick={copyVersion}
            title={t('settings.components.verge.advanced.actions.copyVersion')}
          />
        }
      >
        <span className="text-xs text-muted-foreground tabular-nums">
          v{version}
        </span>
      </SettingItem>
    </SettingList>
  )
}

export default SettingVergeAdvanced
