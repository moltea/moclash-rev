import { useLockFn } from 'ahooks'
import { NetworkIcon, SettingsIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type LogLevel, updateGeo } from 'tauri-plugin-mihomo-api'

import { GuardState } from '@/components/setting/mods/guard-state'
import { useClash } from '@/hooks/use-clash'
import { useClashLog } from '@/hooks/use-clash-log'
import { useDisplayedMixedPort } from '@/hooks/use-displayed-mixed-port'
import { useProfiles } from '@/hooks/use-profiles'
import { useVerge } from '@/hooks/use-verge'
import { invoke_uwp_tool, setDnsOverride } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import getSystem from '@/utils/get-system'
import { BaseDialog, type DialogRef, TooltipIcon } from '@ui/components/base'
import { ClashCoreViewer } from '@ui/components/setting/mods/clash-core-viewer'
import { ClashPortViewer } from '@ui/components/setting/mods/clash-port-viewer'
import { ControllerViewer } from '@ui/components/setting/mods/controller-viewer'
import { DnsViewer } from '@ui/components/setting/mods/dns-viewer'
import { HeaderConfiguration } from '@ui/components/setting/mods/external-controller-cors'
import { NetworkInterfaceViewer } from '@ui/components/setting/mods/network-interface-viewer'
import {
  SettingItem,
  SettingList,
} from '@ui/components/setting/mods/setting-comp'
import { TunnelsViewer } from '@ui/components/setting/mods/tunnels-viewer'
import { WebUIViewer } from '@ui/components/setting/mods/web-ui-viewer'
import { Input } from '@ui/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/ui/select'
import { Switch } from '@ui/components/ui/switch'

const isWIN = getSystem() === 'windows'

interface Props {
  onError: (err: Error) => void
}

const SettingClash = ({ onError }: Props) => {
  const { t } = useTranslation()

  const { clash, version, mutateClash, patchClash } = useClash()
  const { verge, mutateVerge } = useVerge()
  const { current: currentProfile } = useProfiles()
  const dnsEnabled = currentProfile
    ? (verge?.profile_dns_settings?.[currentProfile.uid!]?.enabled ??
      verge?.enable_dns_settings ??
      false)
    : false
  const displayedMixedPort = useDisplayedMixedPort()
  const [, setClashLog] = useClashLog()

  const {
    ipv6,
    'allow-lan': allowLan,
    'log-level': logLevel,
    'unified-delay': unifiedDelay,
  } = clash ?? {}

  const [dnsConfirmation, setDnsConfirmation] = useState<{
    profileUid: string
    source: string
  } | null>(null)
  const [dnsUpdating, setDnsUpdating] = useState(false)

  const webRef = useRef<DialogRef>(null)
  const portRef = useRef<DialogRef>(null)
  const ctrlRef = useRef<DialogRef>(null)
  const coreRef = useRef<DialogRef>(null)
  const networkRef = useRef<DialogRef>(null)
  const dnsRef = useRef<DialogRef>(null)
  const corsRef = useRef<DialogRef>(null)
  const tunnelRef = useRef<DialogRef>(null)

  const onChangeData = (patch: Partial<IConfigData>) => {
    mutateClash((old) => ({ ...old!, ...patch }), false)
  }
  const onUpdateGeo = async () => {
    try {
      await mutate(() => updateGeo(), {
        id: 'update-geo',
        errorNotice: false,
      })
      showNotice.success('settings.feedback.notifications.clash.geoDataUpdated')
    } catch (err: any) {
      showNotice.error(err)
    }
  }

  const handleDnsToggle = useLockFn(
    async (
      enable: boolean,
      confirmation?: string,
      profileUid = currentProfile?.uid,
    ) => {
      if (!profileUid) return
      setDnsUpdating(true)
      try {
        const result = await mutate(
          () => setDnsOverride(profileUid, enable, confirmation),
          {
            id: 'set-dns-override',
            errorNotice: false,
          },
        )
        if (!result.ok) return
        const outcome = result.value
        if (outcome.status === 'confirmation_required') {
          setDnsConfirmation({ profileUid, source: outcome.source })
        } else {
          setDnsConfirmation(null)
        }
        mutateVerge()
        mutateClash()
      } catch (err: any) {
        showNotice.error(err)
      } finally {
        setDnsUpdating(false)
      }
    },
  )

  const closeDnsConfirmation = () => {
    if (!dnsUpdating) setDnsConfirmation(null)
  }

  return (
    <SettingList title={t('settings.sections.clash.title')}>
      <WebUIViewer ref={webRef} />
      <ClashPortViewer ref={portRef} />
      <ControllerViewer ref={ctrlRef} />
      <ClashCoreViewer ref={coreRef} />
      <NetworkInterfaceViewer ref={networkRef} />
      <DnsViewer ref={dnsRef} />
      <BaseDialog
        open={dnsConfirmation !== null}
        title={t('settings.modals.dns.protection.title')}
        okBtn={t('settings.modals.dns.protection.enableAnyway')}
        cancelBtn={t('settings.modals.dns.protection.keepDisabled')}
        loading={dnsUpdating}
        disableCancel={dnsUpdating}
        onCancel={closeDnsConfirmation}
        onClose={closeDnsConfirmation}
        onOk={() => {
          if (dnsConfirmation)
            void handleDnsToggle(
              true,
              dnsConfirmation.source,
              dnsConfirmation.profileUid,
            )
        }}
      >
        <p className="text-xs/relaxed">
          {t('settings.modals.dns.protection.message')}
        </p>
      </BaseDialog>
      <HeaderConfiguration ref={corsRef} />
      <TunnelsViewer ref={tunnelRef} />
      <SettingItem
        label={t('settings.sections.clash.form.fields.allowLan')}
        extra={
          <TooltipIcon
            title={t('settings.sections.clash.form.tooltips.networkInterface')}
            icon={NetworkIcon}
            onClick={() => {
              networkRef.current?.open()
            }}
          />
        }
      >
        <GuardState
          value={allowLan ?? false}
          valueProps="checked"
          onChangeProps="onCheckedChange"
          onCatch={onError}
          onChange={(e) => onChangeData({ 'allow-lan': e })}
          onGuard={(e) => patchClash({ 'allow-lan': e })}
        >
          <Switch />
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t('settings.sections.clash.form.fields.dnsOverwrite')}
        extra={
          <>
            <TooltipIcon
              icon={SettingsIcon}
              onClick={() => dnsRef.current?.open()}
            />
            <TooltipIcon title={t('settings.modals.dns.dialog.profileScope')} />
          </>
        }
      >
        <Switch
          checked={dnsEnabled}
          disabled={!currentProfile || dnsUpdating || dnsConfirmation !== null}
          onCheckedChange={(checked) => handleDnsToggle(checked)}
        />
      </SettingItem>

      <SettingItem label={t('settings.sections.clash.form.fields.ipv6')}>
        <GuardState
          value={ipv6 ?? false}
          valueProps="checked"
          onChangeProps="onCheckedChange"
          onCatch={onError}
          onChange={(e) => onChangeData({ ipv6: e })}
          onGuard={(e) => patchClash({ ipv6: e })}
        >
          <Switch />
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t('settings.sections.clash.form.fields.unifiedDelay')}
        extra={
          <TooltipIcon
            title={t('settings.sections.clash.form.tooltips.unifiedDelay')}
          />
        }
      >
        <GuardState
          value={unifiedDelay ?? false}
          valueProps="checked"
          onChangeProps="onCheckedChange"
          onCatch={onError}
          onChange={(e) => onChangeData({ 'unified-delay': e })}
          onGuard={(e) => patchClash({ 'unified-delay': e })}
        >
          <Switch />
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t('settings.sections.clash.form.fields.logLevel')}
        extra={
          <TooltipIcon
            title={t('settings.sections.clash.form.tooltips.logLevel')}
          />
        }
      >
        <GuardState
          value={logLevel === 'warn' ? 'warning' : (logLevel ?? 'info')}
          onChangeProps="onValueChange"
          onCatch={onError}
          onChange={(e) => onChangeData({ 'log-level': e })}
          onGuard={(e) => {
            setClashLog((pre) => ({
              ...pre!,
              logLevel: e.toUpperCase() as LogLevel,
            }))
            return patchClash({ 'log-level': e })
          }}
        >
          <Select>
            <SelectTrigger size="sm" className="w-auto min-w-24 max-w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debug">
                {t('settings.sections.clash.form.options.logLevel.debug')}
              </SelectItem>
              <SelectItem value="info">
                {t('settings.sections.clash.form.options.logLevel.info')}
              </SelectItem>
              <SelectItem value="warning">
                {t('settings.sections.clash.form.options.logLevel.warning')}
              </SelectItem>
              <SelectItem value="error">
                {t('settings.sections.clash.form.options.logLevel.error')}
              </SelectItem>
              <SelectItem value="silent">
                {t('settings.sections.clash.form.options.logLevel.silent')}
              </SelectItem>
            </SelectContent>
          </Select>
        </GuardState>
      </SettingItem>

      <SettingItem label={t('settings.sections.clash.form.fields.portConfig')}>
        <Input
          readOnly
          autoComplete="new-password"
          value={displayedMixedPort}
          className="h-6 w-24 cursor-pointer"
          onClick={(e) => {
            portRef.current?.open()
            ;(e.target as HTMLElement).blur()
          }}
        />
      </SettingItem>

      <SettingItem
        label={t('settings.sections.clash.form.fields.external')}
        extra={
          <TooltipIcon
            title={t('settings.sections.externalCors.tooltips.open')}
            icon={SettingsIcon}
            onClick={(e) => {
              e.stopPropagation()
              corsRef.current?.open()
            }}
          />
        }
        onClick={() => {
          ctrlRef.current?.open()
        }}
      />

      <SettingItem
        onClick={() => webRef.current?.open()}
        label={t('settings.sections.clash.form.fields.webUI')}
      />

      <SettingItem
        label={t('settings.sections.clash.form.fields.clashCore')}
        extra={
          <TooltipIcon
            icon={SettingsIcon}
            onClick={() => coreRef.current?.open()}
          />
        }
      >
        <span className="text-xs text-muted-foreground tabular-nums">
          {version}
        </span>
      </SettingItem>

      {isWIN && (
        <SettingItem
          onClick={invoke_uwp_tool}
          label={t('settings.sections.clash.form.fields.openUwpTool')}
          extra={
            <TooltipIcon
              title={t('settings.sections.clash.form.tooltips.openUwpTool')}
            />
          }
        />
      )}

      <SettingItem
        onClick={onUpdateGeo}
        label={t('settings.sections.clash.form.fields.updateGeoData')}
      />

      <SettingItem
        label={t('settings.sections.clash.form.fields.tunnels.title')}
        onClick={() => tunnelRef.current?.open()}
      />
    </SettingList>
  )
}

export default SettingClash
