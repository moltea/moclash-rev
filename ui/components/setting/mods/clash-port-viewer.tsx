import { useLockFn, useRequest } from 'ahooks'
import { ShuffleIcon } from 'lucide-react'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useClashInfo } from '@/hooks/use-clash'
import { useDisplayedMixedPort } from '@/hooks/use-displayed-mixed-port'
import { useVerge } from '@/hooks/use-verge'
import { type ProxyPortSettings, saveProxyPorts } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import type { TranslationKey } from '@/types/generated/i18n-keys'
import getSystem from '@/utils/get-system'
import { BaseDialog } from '@ui/components/base'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@ui/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/ui/input-group'
import { Switch } from '@ui/components/ui/switch'

const OS = getSystem()

interface ClashPortViewerRef {
  open: () => void
  close: () => void
}

type ListenerKey = Exclude<keyof ProxyPortSettings, 'mixedPort'>

const LISTENERS: {
  key: ListenerKey
  label: TranslationKey
  visible: boolean
}[] = [
  {
    key: 'socks',
    label: 'settings.modals.clashPort.fields.socks',
    visible: true,
  },
  {
    key: 'http',
    label: 'settings.modals.clashPort.fields.http',
    visible: true,
  },
  {
    key: 'redir',
    label: 'settings.modals.clashPort.fields.redir',
    visible: OS !== 'windows',
  },
  {
    key: 'tproxy',
    label: 'settings.modals.clashPort.fields.tproxy',
    visible: OS === 'linux',
  },
]

const generateRandomPort = () =>
  Math.floor(Math.random() * (65535 - 1025 + 1)) + 1025

const isValidPort = (port: number) => port >= 1 && port <= 65535

const readPortSettings = (
  verge: IVergeConfig | undefined,
  mixedPort: number,
): ProxyPortSettings => ({
  mixedPort,
  socks: {
    enabled: verge?.verge_socks_enabled ?? false,
    port: verge?.verge_socks_port ?? 7898,
  },
  http: {
    enabled: verge?.verge_http_enabled ?? false,
    port: verge?.verge_port ?? 7899,
  },
  redir: {
    enabled: verge?.verge_redir_enabled ?? false,
    port: verge?.verge_redir_port ?? 7895,
  },
  tproxy: {
    enabled: verge?.verge_tproxy_enabled ?? false,
    port: verge?.verge_tproxy_port ?? 7896,
  },
})

interface PortRowProps {
  id: string
  label: string
  secondary?: string
  port: number
  enabled: boolean
  onPortChange: (port: number) => void
  onEnabledChange?: (enabled: boolean) => void
}

const PortRow = ({
  id,
  label,
  secondary,
  port,
  enabled,
  onPortChange,
  onEnabledChange,
}: PortRowProps) => {
  const { t } = useTranslation()

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {secondary && <FieldDescription>{secondary}</FieldDescription>}
      </FieldContent>
      <InputGroup className="w-28" data-disabled={!enabled}>
        <InputGroupInput
          id={id}
          className="tabular-nums"
          value={port}
          disabled={!enabled}
          onChange={(e) =>
            onPortChange(+e.target.value?.replace(/\D+/, '').slice(0, 5))
          }
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            title={t('settings.modals.clashPort.actions.random')}
            aria-label={t('settings.modals.clashPort.actions.random')}
            disabled={!enabled}
            onClick={() => onPortChange(generateRandomPort())}
          >
            <ShuffleIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <Switch
        aria-label={label}
        checked={enabled}
        disabled={!onEnabledChange}
        onCheckedChange={(c) => onEnabledChange?.(c)}
      />
    </Field>
  )
}

export const ClashPortViewer = forwardRef<ClashPortViewerRef>((_, ref) => {
  const { t } = useTranslation()
  const { verge } = useVerge()
  const { clashInfo } = useClashInfo()
  const configuredMixedPort =
    verge?.verge_mixed_port ?? clashInfo?.mixed_port ?? 7897
  const displayedMixedPort = useDisplayedMixedPort()
  const [open, setOpen] = useState(false)
  const [ports, setPorts] = useState(() =>
    readPortSettings(verge, configuredMixedPort),
  )

  const updateListener = (
    key: ListenerKey,
    patch: Partial<ProxyPortSettings[ListenerKey]>,
  ) => setPorts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  const { loading, runAsync: saveSettings } = useRequest(
    async (settings: ProxyPortSettings) =>
      mutate(() => saveProxyPorts(settings), {
        id: 'save-proxy-ports',
        errorNotice: false,
      }),
    {
      manual: true,
      onSuccess: (result) => {
        if (!result.ok) return
        const outcome = result.value
        if (outcome.status === 'conflict') {
          showNotice.error('settings.modals.clashPort.messages.portInUse', {
            port: outcome.port,
          })
          return
        }
        setOpen(false)
        showNotice.success('settings.modals.clashPort.messages.saved')
      },
      onError: (error) => {
        showNotice.error('settings.modals.clashPort.messages.saveFailed', error)
      },
    },
  )

  useImperativeHandle(ref, () => ({
    open: () => {
      setPorts(readPortSettings(verge, configuredMixedPort))
      setOpen(true)
    },
    close: () => setOpen(false),
  }))

  const onSave = useLockFn(async () => {
    const listeners = LISTENERS.map(({ key }) => ports[key])

    const allPorts = [ports.mixedPort, ...listeners.map(({ port }) => port)]
    if (!allPorts.every(isValidPort)) {
      showNotice.error('settings.modals.clashPort.messages.invalidPort')
      return
    }

    const enabledPorts = [
      ports.mixedPort,
      ...listeners.filter(({ enabled }) => enabled).map(({ port }) => port),
    ]
    if (new Set(enabledPorts).size !== enabledPorts.length) {
      showNotice.error('settings.modals.clashPort.messages.duplicatePort')
      return
    }

    await saveSettings(ports)
  })

  return (
    <BaseDialog
      open={open}
      title={t('settings.modals.clashPort.title')}
      className="sm:max-w-md"
      okBtn={loading ? t('shared.statuses.saving') : t('shared.actions.save')}
      loading={loading}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}
    >
      <FieldGroup className="gap-3 py-1">
        <PortRow
          id="clash-port-mixed"
          label={t('settings.modals.clashPort.fields.mixed')}
          secondary={
            displayedMixedPort !== configuredMixedPort
              ? t('settings.modals.clashPort.messages.runningPort', {
                  port: displayedMixedPort,
                })
              : undefined
          }
          port={ports.mixedPort}
          enabled
          onPortChange={(mixedPort) =>
            setPorts((prev) => ({ ...prev, mixedPort }))
          }
        />
        {LISTENERS.filter(({ visible }) => visible).map(({ key, label }) => (
          <PortRow
            key={key}
            id={`clash-port-${key}`}
            label={t(label)}
            port={ports[key].port}
            enabled={ports[key].enabled}
            onPortChange={(port) => updateListener(key, { port })}
            onEnabledChange={(enabled) => updateListener(key, { enabled })}
          />
        ))}
      </FieldGroup>
    </BaseDialog>
  )
})
