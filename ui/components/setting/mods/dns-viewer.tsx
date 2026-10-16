import { useLockFn } from 'ahooks'
import * as yaml from 'js-yaml'
import { InfoIcon, RotateCcwIcon } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useReducer,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useClash } from '@/hooks/use-clash'
import { useProfiles } from '@/hooks/use-profiles'
import { useVerge } from '@/hooks/use-verge'
import {
  applyDnsConfig,
  getDnsConfigContent,
  saveDnsConfig,
  validateDnsConfig,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { useThemeMode } from '@/services/states'
import type { MonacoEditorInstance } from '@/types/monaco'
import { MONACO_FONT_FAMILY } from '@/utils/font-family'
import { BaseDialog, type DialogRef, MonacoEditor } from '@ui/components/base'
import { Alert, AlertDescription } from '@ui/components/ui/alert'
import { Button } from '@ui/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/ui/select'
import { Switch } from '@ui/components/ui/switch'
import { Textarea } from '@ui/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@ui/components/ui/toggle-group'
import { cn } from '@ui/lib/utils'

type NameserverPolicy = Record<string, any>

function parseNameserverPolicy(str: string): NameserverPolicy {
  const result: NameserverPolicy = {}
  if (!str) return result

  const ruleRegex = /\s*([^=]+?)\s*=\s*([^,]+)(?:,|$)/g
  const matchs = [...str.matchAll(ruleRegex)]

  matchs.forEach((match) => {
    const [, domainsPart, serversPart] = match

    const domains = [domainsPart.trim()]
    const servers = serversPart.split(';').map((s) => s.trim())

    domains.forEach((domain) => {
      result[domain] = servers
    })
  })

  return result
}

function formatNameserverPolicy(policy: unknown): string {
  if (!policy || typeof policy !== 'object') return ''

  return Object.entries(policy as Record<string, unknown>)
    .map(([domain, servers]) => {
      const serversStr = Array.isArray(servers) ? servers.join(';') : servers
      return `${domain}=${serversStr}`
    })
    .join(', ')
}

function formatHosts(hosts: unknown): string {
  if (!hosts || typeof hosts !== 'object') return ''

  const result: string[] = []

  Object.entries(hosts as Record<string, unknown>).forEach(
    ([domain, value]) => {
      if (Array.isArray(value)) {
        const ipsStr = value.join(';')
        result.push(`${domain}=${ipsStr}`)
      } else {
        result.push(`${domain}=${value}`)
      }
    },
  )

  return result.join(', ')
}

function parseHosts(str: string): NameserverPolicy {
  const result: NameserverPolicy = {}
  if (!str) return result

  str.split(',').forEach((item) => {
    const parts = item.trim().split('=')
    if (parts.length < 2) return

    const domain = parts[0].trim()
    const valueStr = parts.slice(1).join('=').trim()

    if (valueStr.includes(';')) {
      result[domain] = valueStr
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
    } else {
      result[domain] = valueStr
    }
  })

  return result
}

function parseList(str: string): string[] {
  if (!str?.trim()) return []
  return str
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const DEFAULT_DNS_CONFIG = {
  enable: true,
  listen: ':53',
  'enhanced-mode': 'fake-ip' as 'fake-ip' | 'redir-host',
  'fake-ip-range': '198.18.0.1/16',
  'fake-ip-range6': 'fdfe:dcba:9876::1/64',
  'fake-ip-filter-mode': 'blacklist' as 'blacklist' | 'whitelist',
  'prefer-h3': false,
  'respect-rules': false,
  'use-hosts': false,
  'use-system-hosts': false,
  ipv6: true,
  'fake-ip-filter': [
    '*.lan',
    '*.local',
    '*.arpa',
    'time.*.com',
    'ntp.*.com',
    'time.*.com',
    '+.market.xiaomi.com',
    'localhost.ptlogin2.qq.com',
    '*.msftncsi.com',
    'www.msftconnecttest.com',
  ],
  'default-nameserver': [
    'system',
    '223.6.6.6',
    '8.8.8.8',
    '2400:3200::1',
    '2001:4860:4860::8888',
  ],
  nameserver: [
    '8.8.8.8',
    'https://doh.pub/dns-query',
    'https://dns.alidns.com/dns-query',
  ],
  fallback: [],
  'nameserver-policy': {},
  'proxy-server-nameserver': [],
  'direct-nameserver': [],
  'direct-nameserver-follow-policy': false,
  'fallback-filter': {
    geoip: true,
    'geoip-code': 'CN',
    ipcidr: ['240.0.0.0/4', '0.0.0.0/32'],
    domain: ['+.google.com', '+.facebook.com', '+.youtube.com'],
  },
}

interface DnsFormValues {
  enable: boolean
  listen: string
  enhancedMode: 'fake-ip' | 'redir-host'
  fakeIpRange: string
  fakeIpRange6: string
  fakeIpFilterMode: 'blacklist' | 'whitelist'
  preferH3: boolean
  respectRules: boolean
  useHosts: boolean
  useSystemHosts: boolean
  ipv6: boolean
  fakeIpFilter: string
  nameserver: string
  fallback: string
  defaultNameserver: string
  proxyServerNameserver: string
  directNameserver: string
  directNameserverFollowPolicy: boolean
  fallbackGeoip: boolean
  fallbackGeoipCode: string
  fallbackIpcidr: string
  fallbackDomain: string
  nameserverPolicy: string
  hosts: string
}

const SwitchRow = ({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  label: ReactNode
  description?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) => (
  <Field orientation="horizontal">
    <FieldContent>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
    </FieldContent>
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
  </Field>
)

const InputRow = ({
  id,
  label,
  value,
  placeholder,
  className,
  onValueChange,
}: {
  id: string
  label: ReactNode
  value: string
  placeholder: string
  className: string
  onValueChange: (value: string) => void
}) => (
  <Field orientation="horizontal">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Input
      id={id}
      className={className}
      autoComplete="off"
      spellCheck="false"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onValueChange(e.target.value)}
    />
  </Field>
)

const TextareaRow = ({
  id,
  label,
  description,
  value,
  placeholder,
  maxRows,
  onValueChange,
}: {
  id: string
  label: ReactNode
  description: ReactNode
  value: string
  placeholder: string
  maxRows: 3 | 4
  onValueChange: (value: string) => void
}) => (
  <Field>
    <FieldContent>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <FieldDescription>{description}</FieldDescription>
    </FieldContent>
    <Textarea
      id={id}
      className={cn(
        'min-h-12 resize-y',
        maxRows === 3 ? 'max-h-20' : 'max-h-24',
      )}
      spellCheck="false"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onValueChange(e.target.value)}
    />
  </Field>
)

const SelectRow = <T extends string>({
  id,
  label,
  value,
  options,
  onValueChange,
}: {
  id: string
  label: ReactNode
  value: T
  options: T[]
  onValueChange: (value: T) => void
}) => (
  <Field orientation="horizontal">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Select value={value} onValueChange={(v) => onValueChange(v as T)}>
      <SelectTrigger id={id} className="w-auto min-w-36 max-w-60">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  </Field>
)

export function DnsViewer({ ref }: { ref?: Ref<DialogRef> }) {
  const { t } = useTranslation()
  const { mutateClash } = useClash()
  const { verge } = useVerge()
  const { current: currentProfile } = useProfiles()
  const dnsEnabled = currentProfile
    ? (verge?.profile_dns_settings?.[currentProfile.uid!]?.enabled ??
      verge?.enable_dns_settings ??
      false)
    : false
  const themeMode = useThemeMode()

  const [open, setOpen] = useState(false)
  const [visualization, setVisualization] = useState(true)
  const skipYamlSyncRef = useRef(false)
  const editorRef = useRef<MonacoEditorInstance | null>(null)
  const [values, setValues] = useState<DnsFormValues>({
    enable: DEFAULT_DNS_CONFIG.enable,
    listen: DEFAULT_DNS_CONFIG.listen,
    enhancedMode: DEFAULT_DNS_CONFIG['enhanced-mode'],
    fakeIpRange: DEFAULT_DNS_CONFIG['fake-ip-range'],
    fakeIpRange6: DEFAULT_DNS_CONFIG['fake-ip-range6'],
    fakeIpFilterMode: DEFAULT_DNS_CONFIG['fake-ip-filter-mode'],
    preferH3: DEFAULT_DNS_CONFIG['prefer-h3'],
    respectRules: DEFAULT_DNS_CONFIG['respect-rules'],
    useHosts: DEFAULT_DNS_CONFIG['use-hosts'],
    useSystemHosts: DEFAULT_DNS_CONFIG['use-system-hosts'],
    ipv6: DEFAULT_DNS_CONFIG.ipv6,
    fakeIpFilter: DEFAULT_DNS_CONFIG['fake-ip-filter'].join(', '),
    defaultNameserver: DEFAULT_DNS_CONFIG['default-nameserver'].join(', '),
    nameserver: DEFAULT_DNS_CONFIG.nameserver.join(', '),
    fallback: DEFAULT_DNS_CONFIG.fallback.join(', '),
    proxyServerNameserver:
      DEFAULT_DNS_CONFIG['proxy-server-nameserver']?.join(', ') || '',
    directNameserver: DEFAULT_DNS_CONFIG['direct-nameserver']?.join(', ') || '',
    directNameserverFollowPolicy:
      DEFAULT_DNS_CONFIG['direct-nameserver-follow-policy'] || false,
    fallbackGeoip: DEFAULT_DNS_CONFIG['fallback-filter'].geoip,
    fallbackGeoipCode: DEFAULT_DNS_CONFIG['fallback-filter']['geoip-code'],
    fallbackIpcidr:
      DEFAULT_DNS_CONFIG['fallback-filter'].ipcidr?.join(', ') || '',
    fallbackDomain:
      DEFAULT_DNS_CONFIG['fallback-filter'].domain?.join(', ') || '',
    nameserverPolicy: '',
    hosts: '',
  })

  const [yamlContent, setYamlContent] = useReducer(
    (_: string, next: string) => next,
    '{ isInitValue: true }',
  )

  const updateValuesFromConfig = useCallback((config: any) => {
    if (!config) return

    const dnsConfig = config.dns || {}
    const hostsConfig = config.hosts || {}

    const enhancedMode =
      dnsConfig['enhanced-mode'] || DEFAULT_DNS_CONFIG['enhanced-mode']
    const validEnhancedMode =
      enhancedMode === 'fake-ip' || enhancedMode === 'redir-host'
        ? enhancedMode
        : DEFAULT_DNS_CONFIG['enhanced-mode']

    const fakeIpFilterMode =
      dnsConfig['fake-ip-filter-mode'] ||
      DEFAULT_DNS_CONFIG['fake-ip-filter-mode']
    const validFakeIpFilterMode =
      fakeIpFilterMode === 'blacklist' || fakeIpFilterMode === 'whitelist'
        ? fakeIpFilterMode
        : DEFAULT_DNS_CONFIG['fake-ip-filter-mode']

    setValues({
      enable: dnsConfig.enable ?? DEFAULT_DNS_CONFIG.enable,
      listen: dnsConfig.listen ?? DEFAULT_DNS_CONFIG.listen,
      enhancedMode: validEnhancedMode,
      fakeIpRange:
        dnsConfig['fake-ip-range'] ?? DEFAULT_DNS_CONFIG['fake-ip-range'],
      fakeIpRange6:
        dnsConfig['fake-ip-range6'] ?? DEFAULT_DNS_CONFIG['fake-ip-range6'],
      fakeIpFilterMode: validFakeIpFilterMode,
      preferH3: dnsConfig['prefer-h3'] ?? DEFAULT_DNS_CONFIG['prefer-h3'],
      respectRules:
        dnsConfig['respect-rules'] ?? DEFAULT_DNS_CONFIG['respect-rules'],
      useHosts: dnsConfig['use-hosts'] ?? DEFAULT_DNS_CONFIG['use-hosts'],
      useSystemHosts:
        dnsConfig['use-system-hosts'] ?? DEFAULT_DNS_CONFIG['use-system-hosts'],
      ipv6: dnsConfig.ipv6 ?? DEFAULT_DNS_CONFIG.ipv6,
      fakeIpFilter:
        dnsConfig['fake-ip-filter']?.join(', ') ??
        DEFAULT_DNS_CONFIG['fake-ip-filter'].join(', '),
      nameserver:
        dnsConfig.nameserver?.join(', ') ??
        DEFAULT_DNS_CONFIG.nameserver.join(', '),
      fallback:
        dnsConfig.fallback?.join(', ') ??
        DEFAULT_DNS_CONFIG.fallback.join(', '),
      defaultNameserver:
        dnsConfig['default-nameserver']?.join(', ') ??
        DEFAULT_DNS_CONFIG['default-nameserver'].join(', '),
      proxyServerNameserver:
        dnsConfig['proxy-server-nameserver']?.join(', ') ??
        (DEFAULT_DNS_CONFIG['proxy-server-nameserver']?.join(', ') || ''),
      directNameserver:
        dnsConfig['direct-nameserver']?.join(', ') ??
        (DEFAULT_DNS_CONFIG['direct-nameserver']?.join(', ') || ''),
      directNameserverFollowPolicy:
        dnsConfig['direct-nameserver-follow-policy'] ??
        DEFAULT_DNS_CONFIG['direct-nameserver-follow-policy'],
      fallbackGeoip:
        dnsConfig['fallback-filter']?.geoip ??
        DEFAULT_DNS_CONFIG['fallback-filter'].geoip,
      fallbackGeoipCode:
        dnsConfig['fallback-filter']?.['geoip-code'] ??
        DEFAULT_DNS_CONFIG['fallback-filter']['geoip-code'],
      fallbackIpcidr:
        dnsConfig['fallback-filter']?.ipcidr?.join(', ') ??
        DEFAULT_DNS_CONFIG['fallback-filter'].ipcidr.join(', '),
      fallbackDomain:
        dnsConfig['fallback-filter']?.domain?.join(', ') ??
        DEFAULT_DNS_CONFIG['fallback-filter'].domain.join(', '),
      nameserverPolicy:
        formatNameserverPolicy(dnsConfig['nameserver-policy']) || '',
      hosts: formatHosts(hostsConfig) || '',
    })
  }, [])

  const generateDnsConfig = useCallback(() => {
    const dnsConfig: any = {
      enable: values.enable,
      listen: values.listen,
      'enhanced-mode': values.enhancedMode,
      'fake-ip-range': values.fakeIpRange,
      'fake-ip-range6': values.fakeIpRange6,
      'fake-ip-filter-mode': values.fakeIpFilterMode,
      'prefer-h3': values.preferH3,
      'respect-rules': values.respectRules,
      'use-hosts': values.useHosts,
      'use-system-hosts': values.useSystemHosts,
      ipv6: values.ipv6,
      'fake-ip-filter': parseList(values.fakeIpFilter),
      'default-nameserver': parseList(values.defaultNameserver),
      nameserver: parseList(values.nameserver),
      'nameserver-policy': parseNameserverPolicy(values.nameserverPolicy),
      'direct-nameserver-follow-policy': values.directNameserverFollowPolicy,
      'fallback-filter': {
        geoip: values.fallbackGeoip,
        'geoip-code': values.fallbackGeoipCode,
        ipcidr: parseList(values.fallbackIpcidr),
        domain: parseList(values.fallbackDomain),
      },

      fallback: parseList(values.fallback),
      'proxy-server-nameserver': parseList(values.proxyServerNameserver),
      'direct-nameserver': parseList(values.directNameserver),
    }

    return dnsConfig
  }, [values])

  const updateYamlFromValues = useCallback(() => {
    const config: Record<string, any> = {}

    const dnsConfig = generateDnsConfig()
    if (Object.keys(dnsConfig).length > 0) {
      config.dns = dnsConfig
    }

    config.hosts = parseHosts(values.hosts)

    setYamlContent(yaml.dump(config, { forceQuotes: true }))
  }, [generateDnsConfig, values.hosts])

  const resetToDefaults = useCallback(() => {
    setValues({
      enable: DEFAULT_DNS_CONFIG.enable,
      listen: DEFAULT_DNS_CONFIG.listen,
      enhancedMode: DEFAULT_DNS_CONFIG['enhanced-mode'],
      fakeIpRange: DEFAULT_DNS_CONFIG['fake-ip-range'],
      fakeIpRange6: DEFAULT_DNS_CONFIG['fake-ip-range6'],
      fakeIpFilterMode: DEFAULT_DNS_CONFIG['fake-ip-filter-mode'],
      preferH3: DEFAULT_DNS_CONFIG['prefer-h3'],
      respectRules: DEFAULT_DNS_CONFIG['respect-rules'],
      useHosts: DEFAULT_DNS_CONFIG['use-hosts'],
      useSystemHosts: DEFAULT_DNS_CONFIG['use-system-hosts'],
      ipv6: DEFAULT_DNS_CONFIG.ipv6,
      fakeIpFilter: DEFAULT_DNS_CONFIG['fake-ip-filter'].join(', '),
      defaultNameserver: DEFAULT_DNS_CONFIG['default-nameserver'].join(', '),
      nameserver: DEFAULT_DNS_CONFIG.nameserver.join(', '),
      fallback: DEFAULT_DNS_CONFIG.fallback.join(', '),
      proxyServerNameserver:
        DEFAULT_DNS_CONFIG['proxy-server-nameserver']?.join(', ') || '',
      directNameserver:
        DEFAULT_DNS_CONFIG['direct-nameserver']?.join(', ') || '',
      directNameserverFollowPolicy:
        DEFAULT_DNS_CONFIG['direct-nameserver-follow-policy'] || false,
      fallbackGeoip: DEFAULT_DNS_CONFIG['fallback-filter'].geoip,
      fallbackGeoipCode: DEFAULT_DNS_CONFIG['fallback-filter']['geoip-code'],
      fallbackIpcidr:
        DEFAULT_DNS_CONFIG['fallback-filter'].ipcidr?.join(', ') || '',
      fallbackDomain:
        DEFAULT_DNS_CONFIG['fallback-filter'].domain?.join(', ') || '',
      nameserverPolicy: '',
      hosts: '',
    })

    updateYamlFromValues()
  }, [updateYamlFromValues])

  const updateValuesFromYaml = useCallback(() => {
    try {
      const parsedYaml = yaml.load(yamlContent) as any
      if (!parsedYaml || parsedYaml.isInitValue) return

      skipYamlSyncRef.current = true
      updateValuesFromConfig(parsedYaml)
    } catch {
      showNotice.error('settings.modals.dns.errors.invalidYaml')
    }
  }, [yamlContent, updateValuesFromConfig])

  useEffect(() => {
    if (skipYamlSyncRef.current) {
      skipYamlSyncRef.current = false
      return
    }
    updateYamlFromValues()
  }, [updateYamlFromValues])

  const latestUpdateValuesFromYamlRef = useRef(updateValuesFromYaml)
  const latestUpdateYamlFromValuesRef = useRef(updateYamlFromValues)

  useEffect(() => {
    latestUpdateValuesFromYamlRef.current = updateValuesFromYaml
    latestUpdateYamlFromValuesRef.current = updateYamlFromValues
  }, [updateValuesFromYaml, updateYamlFromValues])

  useEffect(() => {
    if (visualization) {
      latestUpdateValuesFromYamlRef.current()
    } else {
      latestUpdateYamlFromValuesRef.current()
    }
  }, [visualization])

  useEffect(() => {
    return () => {
      editorRef.current?.dispose()
      editorRef.current = null
    }
  }, [])

  const initDnsConfig = useCallback(async () => {
    try {
      const dnsConfig = await getDnsConfigContent()

      if (dnsConfig !== null) {
        const config = yaml.load(dnsConfig) as any

        updateValuesFromConfig(config)
        setYamlContent(dnsConfig)
      } else {
        resetToDefaults()
      }
    } catch (err) {
      console.error('Failed to initialize DNS config', err)
      resetToDefaults()
    }
  }, [resetToDefaults, updateValuesFromConfig])

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        setOpen(true)
        void initDnsConfig()
      },
      close: () => setOpen(false),
    }),
    [initDnsConfig],
  )

  const onSave = useLockFn(async () => {
    try {
      let config: Record<string, any>

      if (visualization) {
        config = {}

        const dnsConfig = generateDnsConfig()
        if (Object.keys(dnsConfig).length > 0) {
          config.dns = dnsConfig
        }

        config.hosts = parseHosts(values.hosts)
      } else {
        const parsedConfig = yaml.load(yamlContent)
        if (typeof parsedConfig !== 'object' || parsedConfig === null) {
          throw new Error(t('settings.modals.dns.errors.invalid'))
        }
        config = parsedConfig as Record<string, any>
      }

      await mutate(() => saveDnsConfig(config), {
        id: 'save-dns-config',
        errorNotice: false,
      })

      const validation = await validateDnsConfig()

      if (validation.status !== 'valid') {
        const errorMsg =
          validation.status === 'invalid'
            ? validation.message
            : 'Configuration validation skipped'
        let cleanErrorMsg = errorMsg

        if (errorMsg.includes('level=error')) {
          const errorLines = errorMsg
            .split('\n')
            .filter(
              (line) =>
                line.includes('level=error') ||
                line.includes('level=fatal') ||
                line.includes('failed'),
            )

          if (errorLines.length > 0) {
            cleanErrorMsg = errorLines
              .map((line) => {
                const msgMatch = line.match(/msg="([^"]+)"/)
                return msgMatch ? msgMatch[1] : line
              })
              .join(', ')
          }
        }

        showNotice.error(
          'settings.modals.dns.messages.configError',
          cleanErrorMsg,
        )
        return
      }

      if (dnsEnabled) {
        await mutate(() => applyDnsConfig(true), {
          id: 'apply-dns-config',
          errorNotice: false,
        })
        mutateClash()
      }

      setOpen(false)
      showNotice.success('settings.modals.dns.messages.saved')
    } catch (err) {
      showNotice.error('settings.modals.dns.messages.configError', err)
    }
  })

  const handleYamlChange = (value?: string) => {
    setYamlContent(value || '')
  }

  const handleChange =
    <K extends keyof DnsFormValues>(field: K) =>
    (value: DnsFormValues[K]) => {
      setValues((prev) => {
        const newValues = {
          ...prev,
          [field]: value,
        }

        if (visualization) {
          setTimeout(() => {
            updateYamlFromValues()
          }, 0)
        }

        return newValues
      })
    }

  return (
    <BaseDialog
      open={open}
      title={
        <div className="flex flex-wrap items-center justify-between gap-2 pe-6">
          {t('settings.modals.dns.dialog.title')}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={resetToDefaults}>
              <RotateCcwIcon data-icon="inline-start" />
              {t('shared.actions.resetToDefault')}
            </Button>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={visualization ? 'visualization' : 'advanced'}
              onValueChange={(next) => {
                if (!next) return
                setVisualization(next === 'visualization')
              }}
            >
              <ToggleGroupItem value="visualization">
                {t('shared.editorModes.visualization')}
              </ToggleGroupItem>
              <ToggleGroupItem value="advanced">
                {t('shared.editorModes.advanced')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      }
      className={cn('sm:max-w-xl', !visualization && 'h-[85vh]')}
      contentClassName={cn(
        'flex flex-col gap-3',
        !visualization && 'overflow-hidden',
      )}
      okBtn={t('shared.actions.save')}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}
    >
      <Alert>
        <InfoIcon />
        <AlertDescription>
          {t('settings.modals.dns.dialog.profileScope')}
        </AlertDescription>
      </Alert>
      <p className="text-xs text-warning italic">
        {t('settings.modals.dns.dialog.warning')}
      </p>

      {visualization ? (
        <div className="flex flex-col gap-6 pb-1">
          <FieldSet>
            <FieldLegend>
              {t('settings.modals.dns.sections.general')}
            </FieldLegend>
            <FieldGroup className="gap-3">
              <SwitchRow
                id="dns-enable"
                label={t('settings.modals.dns.fields.enable')}
                checked={values.enable}
                onCheckedChange={handleChange('enable')}
              />
              <InputRow
                id="dns-listen"
                label={t('settings.modals.dns.fields.listen')}
                value={values.listen}
                placeholder=":53"
                className="w-36"
                onValueChange={handleChange('listen')}
              />
              <SelectRow
                id="dns-enhanced-mode"
                label={t('settings.modals.dns.fields.enhancedMode')}
                value={values.enhancedMode}
                options={['fake-ip', 'redir-host']}
                onValueChange={handleChange('enhancedMode')}
              />
              <InputRow
                id="dns-fake-ip-range"
                label={t('settings.modals.dns.fields.fakeIpRange')}
                value={values.fakeIpRange}
                placeholder="198.18.0.1/16"
                className="w-36"
                onValueChange={handleChange('fakeIpRange')}
              />
              <InputRow
                id="dns-fake-ip-range6"
                label={t('settings.modals.dns.fields.fakeIpRange6')}
                value={values.fakeIpRange6}
                placeholder="fdfe:dcba:9876::1/64"
                className="w-48"
                onValueChange={handleChange('fakeIpRange6')}
              />
              <SelectRow
                id="dns-fake-ip-filter-mode"
                label={t('settings.modals.dns.fields.fakeIpFilterMode')}
                value={values.fakeIpFilterMode}
                options={['blacklist', 'whitelist']}
                onValueChange={handleChange('fakeIpFilterMode')}
              />
              <SwitchRow
                id="dns-ipv6"
                label={t('settings.modals.dns.fields.ipv6.label')}
                description={t('settings.modals.dns.fields.ipv6.description')}
                checked={values.ipv6}
                onCheckedChange={handleChange('ipv6')}
              />
              <SwitchRow
                id="dns-prefer-h3"
                label={t('settings.modals.dns.fields.preferH3.label')}
                description={t(
                  'settings.modals.dns.fields.preferH3.description',
                )}
                checked={values.preferH3}
                onCheckedChange={handleChange('preferH3')}
              />
              <SwitchRow
                id="dns-respect-rules"
                label={t('settings.modals.dns.fields.respectRules.label')}
                description={t(
                  'settings.modals.dns.fields.respectRules.description',
                )}
                checked={values.respectRules}
                onCheckedChange={handleChange('respectRules')}
              />
              <SwitchRow
                id="dns-use-hosts"
                label={t('settings.modals.dns.fields.useHosts.label')}
                description={t(
                  'settings.modals.dns.fields.useHosts.description',
                )}
                checked={values.useHosts}
                onCheckedChange={handleChange('useHosts')}
              />
              <SwitchRow
                id="dns-use-system-hosts"
                label={t('settings.modals.dns.fields.useSystemHosts.label')}
                description={t(
                  'settings.modals.dns.fields.useSystemHosts.description',
                )}
                checked={values.useSystemHosts}
                onCheckedChange={handleChange('useSystemHosts')}
              />
              <SwitchRow
                id="dns-direct-policy"
                label={t('settings.modals.dns.fields.directPolicy.label')}
                description={t(
                  'settings.modals.dns.fields.directPolicy.description',
                )}
                checked={values.directNameserverFollowPolicy}
                onCheckedChange={handleChange('directNameserverFollowPolicy')}
              />
              <TextareaRow
                id="dns-default-nameserver"
                label={t('settings.modals.dns.fields.defaultNameserver.label')}
                description={t(
                  'settings.modals.dns.fields.defaultNameserver.description',
                )}
                value={values.defaultNameserver}
                placeholder="system,223.6.6.6, 8.8.8.8, 2400:3200::1, 2001:4860:4860::8888"
                maxRows={3}
                onValueChange={handleChange('defaultNameserver')}
              />
              <TextareaRow
                id="dns-nameserver"
                label={t('settings.modals.dns.fields.nameserver.label')}
                description={t(
                  'settings.modals.dns.fields.nameserver.description',
                )}
                value={values.nameserver}
                placeholder="8.8.8.8, https://doh.pub/dns-query, https://dns.alidns.com/dns-query"
                maxRows={4}
                onValueChange={handleChange('nameserver')}
              />
              <TextareaRow
                id="dns-fallback"
                label={t('settings.modals.dns.fields.fallback.label')}
                description={t(
                  'settings.modals.dns.fields.fallback.description',
                )}
                value={values.fallback}
                placeholder="https://dns.alidns.com/dns-query, https://dns.google/dns-query, https://cloudflare-dns.com/dns-query"
                maxRows={4}
                onValueChange={handleChange('fallback')}
              />
              <TextareaRow
                id="dns-proxy-server-nameserver"
                label={t('settings.modals.dns.fields.proxy.label')}
                description={t('settings.modals.dns.fields.proxy.description')}
                value={values.proxyServerNameserver}
                placeholder="https://doh.pub/dns-query, https://dns.alidns.com/dns-query"
                maxRows={3}
                onValueChange={handleChange('proxyServerNameserver')}
              />
              <TextareaRow
                id="dns-direct-nameserver"
                label={t('settings.modals.dns.fields.directNameserver.label')}
                description={t(
                  'settings.modals.dns.fields.directNameserver.description',
                )}
                value={values.directNameserver}
                placeholder="system, 223.6.6.6"
                maxRows={3}
                onValueChange={handleChange('directNameserver')}
              />
              <TextareaRow
                id="dns-fake-ip-filter"
                label={t('settings.modals.dns.fields.fakeIpFilter.label')}
                description={t(
                  'settings.modals.dns.fields.fakeIpFilter.description',
                )}
                value={values.fakeIpFilter}
                placeholder="*.lan, *.local, localhost.ptlogin2.qq.com"
                maxRows={4}
                onValueChange={handleChange('fakeIpFilter')}
              />
              <TextareaRow
                id="dns-nameserver-policy"
                label={t('settings.modals.dns.fields.nameserverPolicy.label')}
                description={t(
                  'settings.modals.dns.fields.nameserverPolicy.description',
                )}
                value={values.nameserverPolicy}
                placeholder="+.arpa=10.0.0.1, rule-set:cn=https://doh.pub/dns-query;https://dns.alidns.com/dns-query"
                maxRows={4}
                onValueChange={handleChange('nameserverPolicy')}
              />
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>
              {t('settings.modals.dns.sections.fallbackFilter')}
            </FieldLegend>
            <FieldGroup className="gap-3">
              <SwitchRow
                id="dns-fallback-geoip"
                label={t('settings.modals.dns.fields.geoipFiltering.label')}
                description={t(
                  'settings.modals.dns.fields.geoipFiltering.description',
                )}
                checked={values.fallbackGeoip}
                onCheckedChange={handleChange('fallbackGeoip')}
              />
              <InputRow
                id="dns-fallback-geoip-code"
                label={t('settings.modals.dns.fields.geoipCode')}
                value={values.fallbackGeoipCode}
                placeholder="CN"
                className="w-24"
                onValueChange={handleChange('fallbackGeoipCode')}
              />
              <TextareaRow
                id="dns-fallback-ipcidr"
                label={t('settings.modals.dns.fields.fallbackIpCidr.label')}
                description={t(
                  'settings.modals.dns.fields.fallbackIpCidr.description',
                )}
                value={values.fallbackIpcidr}
                placeholder="240.0.0.0/4, 127.0.0.1/8"
                maxRows={3}
                onValueChange={handleChange('fallbackIpcidr')}
              />
              <TextareaRow
                id="dns-fallback-domain"
                label={t('settings.modals.dns.fields.fallbackDomain.label')}
                description={t(
                  'settings.modals.dns.fields.fallbackDomain.description',
                )}
                value={values.fallbackDomain}
                placeholder="+.google.com, +.facebook.com, +.youtube.com"
                maxRows={3}
                onValueChange={handleChange('fallbackDomain')}
              />
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>{t('settings.modals.dns.sections.hosts')}</FieldLegend>
            <FieldGroup className="gap-3">
              <TextareaRow
                id="dns-hosts"
                label={t('settings.modals.dns.fields.hosts.label')}
                description={t('settings.modals.dns.fields.hosts.description')}
                value={values.hosts}
                placeholder="*.clash.dev=127.0.0.1, alpha.clash.dev=::1, test.com=1.1.1.1;2.2.2.2, baidu.com=google.com"
                maxRows={4}
                onValueChange={handleChange('hosts')}
              />
            </FieldGroup>
          </FieldSet>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
          <MonacoEditor
            height="100%"
            language="yaml"
            value={yamlContent}
            theme={themeMode === 'light' ? 'light' : 'vs-dark'}
            onMount={(editorInstance) => {
              editorRef.current = editorInstance
            }}
            options={{
              tabSize: 2,
              minimap: {
                enabled: document.documentElement.clientWidth >= 1500,
              },
              mouseWheelZoom: true,
              quickSuggestions: {
                strings: true,
                comments: true,
                other: true,
              },
              padding: {
                top: 33,
              },
              fontFamily: MONACO_FONT_FAMILY,
              fontLigatures: false,
              smoothScrolling: true,
            }}
            onChange={handleYamlChange}
          />
        </div>
      )}
    </BaseDialog>
  )
}
