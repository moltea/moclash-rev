import { useLockFn } from 'ahooks'
import { ChevronDownIcon, PencilIcon } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useDisplayedMixedPort } from '@/hooks/use-displayed-mixed-port'
import { useSystemProxyState } from '@/hooks/use-system-proxy-state'
import { useVerge } from '@/hooks/use-verge'
import { useSystemData } from '@/providers/app-data-context'
import {
  getEmbeddedServerPort,
  getNetworkInterfacesInfo,
  getSystemHostname,
} from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import { debugLog } from '@/utils/debug'
import getSystem from '@/utils/get-system'
import {
  BaseDialog,
  BaseFieldset,
  BaseSplitChipEditor,
  type DialogRef,
  TooltipIcon,
} from '@ui/components/base'
import { EditorViewer } from '@ui/components/profile/editor-viewer'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@ui/components/ui/input-group'
import { Switch } from '@ui/components/ui/switch'

const DEFAULT_PAC = `function FindProxyForURL(url, host) {
  return "PROXY %proxy_host%:%mixed-port%; SOCKS5 %proxy_host%:%mixed-port%; DIRECT;";
}`

const domain_subdomain_part = String.raw`(?:[a-z0-9\-\*]+\.|\*)*`
const domain_tld_part = String.raw`(?:\w{2,64}\*?|\*)`
const rDomainSimple = domain_subdomain_part + domain_tld_part

const ipv4_part = String.raw`\d{1,3}`

const ipv6_part = '(?:[a-fA-F0-9:])+'

const rLocal = `localhost|<local>|localdomain`

const getValidReg = (isWindows: boolean) => {
  const rIPv4Unix = String.raw`(?:${ipv4_part}\.){3}${ipv4_part}(?:\/\d{1,2})?`
  const rIPv4Windows = String.raw`(?:${ipv4_part}\.){3}${ipv4_part}`

  const rIPv6Unix = String.raw`(?:${ipv6_part}:+)+${ipv6_part}(?:\/\d{1,3})?`
  const rIPv6Windows = String.raw`(?:${ipv6_part}:+)+${ipv6_part}`

  const rValidPart = `${rDomainSimple}|${
    isWindows ? rIPv4Windows : rIPv4Unix
  }|${isWindows ? rIPv6Windows : rIPv6Unix}|${rLocal}`
  const separator = isWindows ? ';' : ','
  const rValid = String.raw`^(${rValidPart})(?:${separator}\s?(${rValidPart}))*${separator}?$`

  return new RegExp(rValid)
}

const splitBypass = (value?: string) =>
  (value ?? '')
    .split(/[,\n;\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)

export const SysproxyViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation()
  const systemName = getSystem()
  const isWindows = systemName === 'windows'
  const validReg = useMemo(() => getValidReg(isWindows), [isWindows])

  const [open, setOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [pacEditorValue, setPacEditorValue] = useState(DEFAULT_PAC)
  const [pacEditorSavedValue, setPacEditorSavedValue] = useState(DEFAULT_PAC)
  const [saving, setSaving] = useState(false)
  const { verge, patchVerge, mutateVerge } = useVerge()
  const [hostOptions, setHostOptions] = useState<string[]>([])

  const { indicator: isProxyReallyEnabled, invalidateProxyState } =
    useSystemProxyState()

  const {
    enable_system_proxy: enabled,
    proxy_auto_config,
    pac_file_content,
    enable_proxy_guard,
    enable_bypass_check,
    use_default_bypass,
    system_proxy_bypass,
    proxy_guard_duration,
    proxy_host,
  } = verge ?? {}

  const [value, setValue] = useState({
    guard: enable_proxy_guard,
    enable_bypass_check: enable_bypass_check ?? true,
    bypass: system_proxy_bypass,
    duration: proxy_guard_duration ?? 10,
    use_default: use_default_bypass ?? true,
    pac: proxy_auto_config,
    pac_content: pac_file_content ?? DEFAULT_PAC,
    proxy_host: proxy_host ?? '127.0.0.1',
  })
  const [embeddedServerPort, setEmbeddedServerPort] = useState<number | null>(
    null,
  )

  useEffect(() => {
    getEmbeddedServerPort().then(setEmbeddedServerPort).catch(console.error)
  }, [])

  const separator = useMemo(() => (isWindows ? ';' : ','), [isWindows])

  const defaultBypass = () => {
    if (isWindows) {
      return 'localhost;127.*;192.168.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;*.local;<local>'
    }
    if (systemName === 'linux') {
      return 'localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,::1'
    }
    return '127.0.0.1,192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,localhost,*.local,*.crashlytics.com,<local>'
  }

  const { systemProxyAddress } = useSystemData()
  const displayedMixedPort = useDisplayedMixedPort()

  const getSystemProxyAddress = useMemo(() => {
    const isPacMode = value.pac ?? false

    if (isPacMode) {
      const host = value.proxy_host || '127.0.0.1'
      return `${host}:${displayedMixedPort}`
    } else {
      return systemProxyAddress
    }
  }, [value.pac, value.proxy_host, displayedMixedPort, systemProxyAddress])
  const getCurrentPacUrl = useMemo(() => {
    const host = value.proxy_host || '127.0.0.1'
    return embeddedServerPort
      ? `http://${host}:${embeddedServerPort}/commands/pac`
      : '-'
  }, [embeddedServerPort, value.proxy_host])

  const bypassError =
    value.enable_bypass_check &&
    !value.pac &&
    !value.use_default &&
    value.bypass
      ? !validReg.test(value.bypass)
      : false

  const openPacEditor = () => {
    const nextPac = value.pac_content ?? DEFAULT_PAC
    setPacEditorValue(nextPac)
    setPacEditorSavedValue(nextPac)
    setEditorOpen(true)
  }

  const handleSavePac = useLockFn(async () => {
    const nextPac =
      pacEditorValue.trim().length > 0 ? pacEditorValue : DEFAULT_PAC

    setValue((current) => ({ ...current, pac_content: nextPac }))
    setPacEditorSavedValue(nextPac)
  })

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true)
      setValue({
        guard: enable_proxy_guard,
        enable_bypass_check: enable_bypass_check ?? true,
        bypass: system_proxy_bypass,
        duration: proxy_guard_duration ?? 10,
        use_default: use_default_bypass ?? true,
        pac: proxy_auto_config,
        pac_content: pac_file_content ?? DEFAULT_PAC,
        proxy_host: proxy_host ?? '127.0.0.1',
      })
      fetchNetworkInterfaces()
    },
    close: () => setOpen(false),
  }))

  const fetchNetworkInterfaces = async () => {
    try {
      const interfaces = await getNetworkInterfacesInfo()
      const ipAddresses: string[] = []

      interfaces.forEach((iface) => {
        iface.addr.forEach((address) => {
          if (address.V4?.ip) {
            ipAddresses.push(address.V4.ip)
          }
          if (address.V6?.ip) {
            ipAddresses.push(address.V6.ip)
          }
        })
      })

      let hostname = ''
      try {
        hostname = await getSystemHostname()
        debugLog('获取到主机名:', hostname)
      } catch (err) {
        console.error('获取主机名失败:', err)
      }

      const options = ['127.0.0.1', 'localhost']

      if (hostname) {
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
          hostname = `${hostname}.local`
          options.push(hostname)
          debugLog('主机名已添加到选项中:', hostname)
        } else {
          debugLog('主机名与已有选项重复:', hostname)
        }
      } else {
        debugLog('主机名为空')
      }

      options.push(...ipAddresses)

      const uniqueOptions = Array.from(new Set(options))
      debugLog('最终选项列表:', uniqueOptions)
      setHostOptions(uniqueOptions)
    } catch (error) {
      console.error('获取网络接口失败:', error)
      setHostOptions(['127.0.0.1', 'localhost'])
    }
  }

  const onSave = useLockFn(async () => {
    if (value.duration < 1) {
      showNotice.error('settings.modals.sysproxy.messages.durationTooShort')
      return
    }
    if (
      value.enable_bypass_check &&
      !value.pac &&
      !value.use_default &&
      value.bypass &&
      !validReg.test(value.bypass)
    ) {
      showNotice.error('settings.modals.sysproxy.messages.invalidBypass')
      return
    }

    const ipv4Regex =
      /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/
    const hostnameRegex =
      /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/

    if (
      !ipv4Regex.test(value.proxy_host) &&
      !ipv6Regex.test(value.proxy_host) &&
      !hostnameRegex.test(value.proxy_host)
    ) {
      showNotice.error('settings.modals.sysproxy.messages.invalidProxyHost')
      return
    }

    setSaving(true)
    setOpen(false)
    setSaving(false)
    const patch: Partial<IVergeConfig> = {}

    if (value.guard !== enable_proxy_guard) {
      patch.enable_proxy_guard = value.guard
    }
    if (value.enable_bypass_check !== enable_bypass_check) {
      patch.enable_bypass_check = value.enable_bypass_check
    }
    if (value.duration !== proxy_guard_duration) {
      patch.proxy_guard_duration = value.duration
    }
    if (value.bypass !== system_proxy_bypass) {
      patch.system_proxy_bypass = value.bypass
    }
    if (value.pac !== proxy_auto_config) {
      patch.proxy_auto_config = value.pac
    }
    if (value.use_default !== use_default_bypass) {
      patch.use_default_bypass = value.use_default
    }

    let pacContent = value.pac_content
    if (pacContent) {
      pacContent = pacContent.replace(/%proxy_host%/g, value.proxy_host)
      const mixedPortStr = displayedMixedPort.toString()
      pacContent = pacContent.replace(/%mixed-port%/g, mixedPortStr)
    }

    if (pacContent !== pac_file_content) {
      patch.pac_file_content = pacContent
    }

    let proxyHost = value.proxy_host
    if (
      ipv6Regex.test(proxyHost) &&
      !proxyHost.startsWith('[') &&
      !proxyHost.endsWith(']')
    ) {
      proxyHost = `[${proxyHost}]`
    }

    if (proxyHost !== proxy_host) {
      patch.proxy_host = proxyHost
    }

    Promise.resolve().then(async () => {
      try {
        if (Object.keys(patch).length > 0) {
          mutateVerge({ ...verge, ...patch }, false)
        }
        if (Object.keys(patch).length > 0) {
          await patchVerge(patch)
        }
        try {
          await invalidateProxyState()
        } catch (err) {
          console.warn('代理状态更新失败:', err)
        }
      } catch (err) {
        console.error('配置保存失败:', err)
        mutateVerge()
        showNotice.error(err)
      }
    })
  })

  return (
    <BaseDialog
      open={open}
      title={t('settings.modals.sysproxy.title')}
      className="sm:max-w-md"
      okBtn={t('shared.actions.save')}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}
      loading={saving}
      disableOk={saving}
    >
      <FieldGroup className="gap-3 py-1">
        <BaseFieldset
          label={t('settings.modals.sysproxy.fieldsets.currentStatus')}
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">
              {t('settings.modals.sysproxy.fields.enableStatus')}
            </dt>
            <dd className="font-medium">
              {isProxyReallyEnabled
                ? t('shared.statuses.enabled')
                : t('shared.statuses.disabled')}
            </dd>
            {!value.pac && (
              <>
                <dt className="text-muted-foreground">
                  {t('settings.modals.sysproxy.fields.serverAddr')}
                </dt>
                <dd className="font-medium break-all">
                  {getSystemProxyAddress}
                </dd>
              </>
            )}
            {value.pac && (
              <>
                <dt className="text-muted-foreground">
                  {t('settings.modals.sysproxy.fields.pacUrl')}
                </dt>
                <dd className="font-medium break-all">
                  {getCurrentPacUrl || '-'}
                </dd>
              </>
            )}
          </dl>
        </BaseFieldset>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="sysproxy-host">
            {t('settings.modals.sysproxy.fields.proxyHost')}
          </FieldLabel>
          <InputGroup className="w-44">
            <InputGroupInput
              id="sysproxy-host"
              placeholder="127.0.0.1"
              value={value.proxy_host}
              onChange={(e) => {
                const newInputValue = e.target.value
                setValue((v) => ({
                  ...v,
                  proxy_host: newInputValue || '127.0.0.1',
                }))
              }}
            />
            <InputGroupAddon align="inline-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={t('settings.modals.sysproxy.fields.proxyHost')}
                    disabled={hostOptions.length === 0}
                  >
                    <ChevronDownIcon />
                  </InputGroupButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-64">
                  <DropdownMenuGroup>
                    {hostOptions.map((option) => (
                      <DropdownMenuItem
                        key={option}
                        onSelect={() =>
                          setValue((v) => ({
                            ...v,
                            proxy_host: option || '127.0.0.1',
                          }))
                        }
                      >
                        {option}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <Field orientation="horizontal" data-disabled={!enabled}>
          <FieldLabel htmlFor="sysproxy-pac">
            {t('settings.modals.sysproxy.fields.usePacMode')}
          </FieldLabel>
          <Switch
            id="sysproxy-pac"
            disabled={!enabled}
            checked={value.pac ?? false}
            onCheckedChange={(e) => setValue((v) => ({ ...v, pac: e }))}
          />
        </Field>

        <Field orientation="horizontal" data-disabled={!enabled}>
          <div className="flex flex-1 items-center gap-1">
            <FieldLabel htmlFor="sysproxy-guard">
              {t('settings.modals.sysproxy.fields.proxyGuard')}
            </FieldLabel>
            <TooltipIcon
              title={t('settings.modals.sysproxy.tooltips.proxyGuard')}
            />
          </div>
          <Switch
            id="sysproxy-guard"
            disabled={!enabled}
            checked={value.guard ?? false}
            onCheckedChange={(e) => setValue((v) => ({ ...v, guard: e }))}
          />
        </Field>

        <Field orientation="horizontal" data-disabled={!enabled}>
          <FieldLabel htmlFor="sysproxy-guard-duration">
            {t('settings.modals.sysproxy.fields.guardDuration')}
          </FieldLabel>
          <InputGroup className="w-28" data-disabled={!enabled}>
            <InputGroupInput
              id="sysproxy-guard-duration"
              disabled={!enabled}
              value={value.duration}
              onChange={(e) => {
                setValue((v) => ({
                  ...v,
                  duration: +e.target.value.replace(/\D/, ''),
                }))
              }}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>s</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Field>

        {!value.pac && (
          <Field orientation="horizontal" data-disabled={!enabled}>
            <FieldLabel htmlFor="sysproxy-use-default">
              {t('settings.modals.sysproxy.fields.alwaysUseDefaultBypass')}
            </FieldLabel>
            <Switch
              id="sysproxy-use-default"
              disabled={!enabled}
              checked={value.use_default}
              onCheckedChange={(e) => {
                if (!e && !value.bypass) {
                  const nextBypass = defaultBypass()
                  setValue((v) => ({
                    ...v,
                    use_default: e,
                    bypass: nextBypass,
                  }))
                  return
                }
                setValue((v) => ({ ...v, use_default: e }))
              }}
            />
          </Field>
        )}

        {!value.pac && (
          <Field orientation="horizontal" data-disabled={!enabled}>
            <FieldLabel htmlFor="sysproxy-bypass-check">
              {t('settings.modals.sysproxy.fields.enableBypassCheck')}
            </FieldLabel>
            <Switch
              id="sysproxy-bypass-check"
              disabled={!enabled}
              checked={value.enable_bypass_check}
              onCheckedChange={(e) =>
                setValue((v) => ({ ...v, enable_bypass_check: e }))
              }
            />
          </Field>
        )}

        {!value.pac && !value.use_default && (
          <BaseSplitChipEditor
            value={value.bypass ?? ''}
            separator={separator}
            disabled={!enabled}
            error={bypassError}
            helperText={
              bypassError
                ? t('settings.modals.sysproxy.messages.invalidBypass')
                : undefined
            }
            placeholder="localhost"
            ariaLabel={t('settings.modals.sysproxy.fields.proxyBypass')}
            onChange={(nextValue) => {
              setValue((v) => ({ ...v, bypass: nextValue }))
            }}
            renderHeader={(modeToggle) => (
              <Field orientation="horizontal">
                <FieldLabel>
                  {t('settings.modals.sysproxy.fields.proxyBypass')}
                </FieldLabel>
                {modeToggle}
              </Field>
            )}
          />
        )}

        {!value.pac && value.use_default && (
          <Field>
            <FieldLabel>
              {t('settings.modals.sysproxy.fields.bypass')}
            </FieldLabel>
            <div className="flex flex-wrap gap-1">
              {splitBypass(defaultBypass()).map((item) => (
                <Badge key={item} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
          </Field>
        )}

        {value.pac && (
          <Field orientation="horizontal">
            <FieldLabel>
              {t('settings.modals.sysproxy.fields.pacScriptContent')}
            </FieldLabel>
            <Button variant="outline" size="sm" onClick={openPacEditor}>
              <PencilIcon data-icon="inline-start" />
              {t('settings.modals.sysproxy.actions.editPac')}
            </Button>
            {editorOpen && (
              <EditorViewer
                open={true}
                title={t('settings.modals.sysproxy.actions.editPac')}
                value={pacEditorValue}
                language="javascript"
                path="sysproxy-pac.js"
                dirty={pacEditorValue !== pacEditorSavedValue}
                onChange={setPacEditorValue}
                onSave={handleSavePac}
                onClose={() => setEditorOpen(false)}
              />
            )}
          </Field>
        )}
      </FieldGroup>
    </BaseDialog>
  )
})
