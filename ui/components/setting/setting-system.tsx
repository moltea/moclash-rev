import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { GuardState } from '@/components/setting/mods/guard-state'
import { useVerge } from '@/hooks/use-verge'
import { type DialogRef, TooltipIcon } from '@ui/components/base'
import {
  SettingItem,
  SettingList,
} from '@ui/components/setting/mods/setting-comp'
import { SysproxyViewer } from '@ui/components/setting/mods/sysproxy-viewer'
import { TunViewer } from '@ui/components/setting/mods/tun-viewer'
import ProxyControlSwitches from '@ui/components/shared/proxy-control-switches'
import { Switch } from '@ui/components/ui/switch'

interface Props {
  onError?: (err: Error) => void
}

const SettingSystem = ({ onError }: Props) => {
  const { t } = useTranslation()

  const { verge, mutateVerge, patchVerge } = useVerge()

  const { enable_auto_launch, enable_silent_start } = verge ?? {}

  const sysproxyRef = useRef<DialogRef>(null)
  const tunRef = useRef<DialogRef>(null)

  const onChangeData = (patch: Partial<IVergeConfig>) => {
    mutateVerge({ ...verge, ...patch }, false)
  }

  return (
    <SettingList title={t('settings.sections.system.title')}>
      <SysproxyViewer ref={sysproxyRef} />
      <TunViewer ref={tunRef} />

      <ProxyControlSwitches
        label={t('settings.sections.system.toggles.tunMode')}
        onError={onError}
      />

      <ProxyControlSwitches
        label={t('settings.sections.system.toggles.systemProxy')}
        onError={onError}
      />

      <SettingItem label={t('settings.sections.system.fields.autoLaunch')}>
        <GuardState
          value={enable_auto_launch ?? false}
          valueProps="checked"
          onChangeProps="onCheckedChange"
          onCatch={onError}
          onChange={(e) => {
            onChangeData({ enable_auto_launch: e })
          }}
          onGuard={async (e) => {
            try {
              onChangeData({ enable_auto_launch: e })
              await patchVerge({ enable_auto_launch: e })
              return Promise.resolve()
            } catch (error) {
              onChangeData({ enable_auto_launch: !e })
              return Promise.reject(error)
            }
          }}
        >
          <Switch />
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t('settings.sections.system.fields.silentStart')}
        extra={
          <TooltipIcon
            title={t('settings.sections.system.tooltips.silentStart')}
          />
        }
      >
        <GuardState
          value={enable_silent_start ?? false}
          valueProps="checked"
          onChangeProps="onCheckedChange"
          onCatch={onError}
          onChange={(e) => onChangeData({ enable_silent_start: e })}
          onGuard={(e) => patchVerge({ enable_silent_start: e })}
        >
          <Switch />
        </GuardState>
      </SettingItem>
    </SettingList>
  )
}

export default SettingSystem
