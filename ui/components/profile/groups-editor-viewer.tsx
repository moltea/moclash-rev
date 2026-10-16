import { arrayMove } from '@dnd-kit/helpers'
import { useLockFn } from 'ahooks'
import {
  cancelIdleCallback,
  requestIdleCallback,
} from 'foxact/request-idle-callback'
import * as yaml from 'js-yaml'
import { ArrowDownToLineIcon, ArrowUpToLineIcon } from 'lucide-react'
import {
  type ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  getNetworkInterfaces,
  readProfileFile,
  saveProfileFile,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { useThemeMode } from '@/services/states'
import type { TranslationKey } from '@/types/generated/i18n-keys'
import type { MonacoEditorInstance } from '@/types/monaco'
import { MONACO_FONT_FAMILY } from '@/utils/font-family'
import { parseYamlSafe } from '@/utils/yaml'
import { BaseSearchBox, MonacoEditor } from '@ui/components/base'
import { GroupItem } from '@ui/components/profile/group-item'
import { Button } from '@ui/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@ui/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/ui/select'
import { Switch } from '@ui/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/ui/tabs'

import { EditorCombobox } from './editor-combobox'
import { EditorDialog } from './editor-dialog'
import {
  buildGroupedItems,
  type GroupedVirtualItem,
  GroupedVirtualList,
} from './grouped-virtual-list'

const GROUP_STRATEGIES = [
  'select',
  'url-test',
  'fallback',
  'load-balance',
  'relay',
] as const

const EXCLUDE_TYPES = [
  'Direct',
  'Reject',
  'RejectDrop',
  'Compatible',
  'Pass',
  'Dns',
  'Shadowsocks',
  'ShadowsocksR',
  'Snell',
  'Socks5',
  'Http',
  'Vmess',
  'Vless',
  'Trojan',
  'Hysteria',
  'Hysteria2',
  'WireGuard',
  'Tuic',
  'Mieru',
  'Masque',
  'AnyTLS',
  'Sudoku',
  'Relay',
  'Selector',
  'Fallback',
  'URLTest',
  'LoadBalance',
  'Ssh',
]

const FormRow = ({
  label,
  htmlFor,
  children,
}: {
  label: ReactNode
  htmlFor?: string
  children: ReactNode
}) => (
  <Field orientation="horizontal">
    <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
    <div className="w-3/5 shrink-0">{children}</div>
  </Field>
)

const SwitchRow = ({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: ReactNode
  checked?: boolean
  onCheckedChange: (checked: boolean) => void
}) => (
  <Field orientation="horizontal">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Switch
      id={id}
      checked={checked ?? false}
      onCheckedChange={onCheckedChange}
    />
  </Field>
)

const parseIntValue = (value: string) => parseInt(value, 10)

interface Props {
  proxiesUid: string
  mergeUid: string
  profileUid: string
  property: string
  open: boolean
  onClose: () => void
  onSave?: (prev?: string, curr?: string) => void
}

const builtinProxyPolicies = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']

const PROXY_STRATEGY_LABEL_KEYS: Record<string, TranslationKey> = {
  select: 'proxies.components.enums.strategies.select',
  'url-test': 'proxies.components.enums.strategies.url-test',
  fallback: 'proxies.components.enums.strategies.fallback',
  'load-balance': 'proxies.components.enums.strategies.load-balance',
  relay: 'proxies.components.enums.strategies.relay',
}

const PROXY_POLICY_LABEL_KEYS: Record<string, TranslationKey> =
  builtinProxyPolicies.reduce(
    (acc, policy) => {
      acc[policy] =
        `proxies.components.enums.policies.${policy}` as TranslationKey
      return acc
    },
    {} as Record<string, TranslationKey>,
  )

const normalizeDeleteSeq = (input?: unknown): string[] => {
  if (!Array.isArray(input)) {
    return []
  }

  const names = input
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }

      if (
        item &&
        typeof item === 'object' &&
        'name' in item &&
        typeof (item as { name: unknown }).name === 'string'
      ) {
        return (item as { name: string }).name
      }

      return undefined
    })
    .filter(
      (name): name is string => typeof name === 'string' && name.length > 0,
    )

  return Array.from(new Set(names))
}

const buildGroupsYaml = (
  prepend: IProxyGroupConfig[],
  append: IProxyGroupConfig[],
  deleteList: string[],
) => {
  return yaml.dump(
    {
      prepend,
      append,
      delete: deleteList,
    },
    { forceQuotes: true },
  )
}

const findRealIndex = (
  list: IProxyGroupConfig[],
  filtered: IProxyGroupConfig[],
  filteredIndex: number,
): number => {
  const item = filtered[filteredIndex]
  if (!item) return -1
  return list.findIndex((group) => group.name === item.name)
}

export const GroupsEditorViewer = (props: Props) => {
  const { mergeUid, proxiesUid, profileUid, property, open, onClose, onSave } =
    props
  const { t } = useTranslation()
  const translateStrategy = useCallback(
    (value: string) =>
      PROXY_STRATEGY_LABEL_KEYS[value]
        ? t(PROXY_STRATEGY_LABEL_KEYS[value])
        : value,
    [t],
  )
  const translatePolicy = useCallback(
    (value: string) =>
      PROXY_POLICY_LABEL_KEYS[value]
        ? t(PROXY_POLICY_LABEL_KEYS[value])
        : value,
    [t],
  )
  const themeMode = useThemeMode()
  const editorRef = useRef<MonacoEditorInstance | null>(null)
  const [prevData, setPrevData] = useState('')
  const [currData, setCurrData] = useState('')
  const [visualization, setVisualization] = useState(true)
  const [match, setMatch] = useState(() => (_: string) => true)
  const [interfaceNameList, setInterfaceNameList] = useState<string[]>([])
  const { control, ...formIns } = useForm<IProxyGroupConfig>({
    defaultValues: {
      type: 'select',
      name: '',
      interval: 300,
      timeout: 5000,
      'max-failed-times': 5,
      lazy: true,
    },
  })
  const [groupList, setGroupList] = useState<IProxyGroupConfig[]>([])
  const [proxyPolicyList, setProxyPolicyList] = useState<string[]>([])
  const [proxyProviderList, setProxyProviderList] = useState<string[]>([])
  const [prependSeq, setPrependSeq] = useState<IProxyGroupConfig[]>([])
  const [appendSeq, setAppendSeq] = useState<IProxyGroupConfig[]>([])
  const [deleteSeq, setDeleteSeq] = useState<string[]>([])
  const hasLoadedSeqConfigRef = useRef(false)

  const filteredPrependSeq = useMemo(
    () => prependSeq.filter((group) => match(group.name)),
    [prependSeq, match],
  )
  const filteredGroupList = useMemo(
    () => groupList.filter((group) => match(group.name)),
    [groupList, match],
  )
  const filteredAppendSeq = useMemo(
    () => appendSeq.filter((group) => match(group.name)),
    [appendSeq, match],
  )

  const items = useMemo(
    () =>
      buildGroupedItems(
        filteredPrependSeq,
        filteredGroupList,
        filteredAppendSeq,
        (group) => group.name,
      ),
    [filteredPrependSeq, filteredGroupList, filteredAppendSeq],
  )

  const renderItem = (entry: GroupedVirtualItem<IProxyGroupConfig>) => {
    const { category, item } = entry

    if (category === 'original') {
      const isDeleted = deleteSeq.includes(item.name)
      return (
        <GroupItem
          type={isDeleted ? 'delete' : 'original'}
          group={item}
          onDelete={() => {
            if (isDeleted) {
              setDeleteSeq(deleteSeq.filter((v) => v !== item.name))
            } else {
              setDeleteSeq((prev) => [...prev, item.name])
            }
          }}
        />
      )
    }

    if (category === 'prepend') {
      return (
        <GroupItem
          type="prepend"
          group={item}
          onDelete={() => {
            setPrependSeq(prependSeq.filter((v) => v.name !== item.name))
          }}
        />
      )
    }

    return (
      <GroupItem
        type="append"
        group={item}
        onDelete={() => {
          setAppendSeq(appendSeq.filter((v) => v.name !== item.name))
        }}
      />
    )
  }

  const onReorder = (
    category: 'prepend' | 'append',
    activeIndex: number,
    overIndex: number,
  ) => {
    const list = category === 'prepend' ? prependSeq : appendSeq
    const filtered =
      category === 'prepend' ? filteredPrependSeq : filteredAppendSeq
    const setList = category === 'prepend' ? setPrependSeq : setAppendSeq
    const activeRealIndex = findRealIndex(list, filtered, activeIndex)
    const overRealIndex = findRealIndex(list, filtered, overIndex)
    if (
      activeRealIndex < 0 ||
      overRealIndex < 0 ||
      activeRealIndex === overRealIndex
    ) {
      return
    }

    setList(arrayMove(list, activeRealIndex, overRealIndex))
  }

  const fetchContent = useCallback(async () => {
    hasLoadedSeqConfigRef.current = false
    const data = await readProfileFile(property)
    const obj = parseYamlSafe(data) as ISeqProfileConfig | null | undefined

    setPrevData(data)
    setCurrData(data)

    if (obj === undefined) {
      setVisualization(false)
      return
    }

    setPrependSeq(obj?.prepend || [])
    setAppendSeq(obj?.append || [])
    setDeleteSeq((prev) => {
      const normalized = normalizeDeleteSeq(obj?.delete)
      if (
        normalized.length === prev.length &&
        normalized.every((item, index) => item === prev[index])
      ) {
        return prev
      }
      return normalized
    })
    hasLoadedSeqConfigRef.current = true
  }, [property])

  const handleVisualizationToggle = () => {
    if (visualization) {
      setVisualization(false)
      return
    }

    const obj = parseYamlSafe(currData) as ISeqProfileConfig | null | undefined
    if (obj === undefined) {
      hasLoadedSeqConfigRef.current = false
      return
    }

    hasLoadedSeqConfigRef.current = true
    startTransition(() => {
      setPrependSeq(obj?.prepend ?? [])
      setAppendSeq(obj?.append ?? [])
      setDeleteSeq((prev) => {
        const normalized = normalizeDeleteSeq(obj?.delete)
        if (
          normalized.length === prev.length &&
          normalized.every((item, index) => item === prev[index])
        ) {
          return prev
        }
        return normalized
      })
    })
    setVisualization(true)
  }

  useEffect(() => {
    if (hasLoadedSeqConfigRef.current && prependSeq && appendSeq && deleteSeq) {
      const serialize = () => {
        if (!hasLoadedSeqConfigRef.current) {
          return
        }

        try {
          setCurrData(buildGroupsYaml(prependSeq, appendSeq, deleteSeq))
        } catch (e) {
          console.warn('[GroupsEditorViewer] yaml.dump failed:', e)
        }
      }

      const handle = requestIdleCallback(serialize)
      return () => {
        cancelIdleCallback(handle)
      }
    }
  }, [prependSeq, appendSeq, deleteSeq])

  const fetchProxyPolicy = useCallback(async () => {
    const data = await readProfileFile(profileUid)
    const proxiesData = await readProfileFile(proxiesUid)
    const originGroupsObj = parseYamlSafe(data) as {
      'proxy-groups': IProxyGroupConfig[]
    } | null

    const originProxiesObj = parseYamlSafe(data) as { proxies: [] } | null
    const originProxies = originProxiesObj?.proxies || []
    const moreProxiesObj = parseYamlSafe(
      proxiesData,
    ) as ISeqProfileConfig | null
    const morePrependProxies = moreProxiesObj?.prepend || []
    const moreAppendProxies = moreProxiesObj?.append || []
    const moreDeleteProxies = normalizeDeleteSeq(moreProxiesObj?.delete)

    const proxies = morePrependProxies.concat(
      originProxies.filter((proxy: any) => {
        const proxyName =
          typeof proxy === 'string'
            ? proxy
            : (proxy?.name as string | undefined)
        return proxyName ? !moreDeleteProxies.includes(proxyName) : true
      }),
      moreAppendProxies,
    )

    const proxyNames = proxies
      .map((proxy: any) =>
        typeof proxy === 'string' ? proxy : (proxy?.name as string | undefined),
      )
      .filter(
        (name): name is string => typeof name === 'string' && name.length > 0,
      )

    const computedPolicyList = builtinProxyPolicies.concat(
      prependSeq.map((group: IProxyGroupConfig) => group.name),
      (originGroupsObj?.['proxy-groups'] || [])
        .map((group: IProxyGroupConfig) => group.name)
        .filter((name) => !deleteSeq.includes(name)),
      appendSeq.map((group: IProxyGroupConfig) => group.name),
      proxyNames,
    )

    setProxyPolicyList(Array.from(new Set(computedPolicyList)))
  }, [appendSeq, deleteSeq, prependSeq, profileUid, proxiesUid])
  const fetchProfile = useCallback(async () => {
    const data = await readProfileFile(profileUid)
    const mergeData = await readProfileFile(mergeUid)
    const globalMergeData = await readProfileFile('Merge')

    const originGroupsObj = parseYamlSafe(data) as {
      'proxy-groups': IProxyGroupConfig[]
    } | null

    const originProviderObj = parseYamlSafe(data) as {
      'proxy-providers': Record<string, unknown>
    } | null
    const originProvider = originProviderObj?.['proxy-providers'] || {}

    const moreProviderObj = parseYamlSafe(mergeData) as {
      'proxy-providers': Record<string, unknown>
    } | null
    const moreProvider = moreProviderObj?.['proxy-providers'] || {}

    const globalProviderObj = parseYamlSafe(globalMergeData) as {
      'proxy-providers': Record<string, unknown>
    } | null
    const globalProvider = globalProviderObj?.['proxy-providers'] || {}

    const provider = Object.assign(
      {},
      originProvider,
      moreProvider,
      globalProvider,
    )

    setProxyProviderList(Object.keys(provider))
    setGroupList(originGroupsObj?.['proxy-groups'] || [])
  }, [mergeUid, profileUid])
  const getInterfaceNameList = useCallback(async () => {
    const list = await getNetworkInterfaces()
    setInterfaceNameList(list)
  }, [])
  useEffect(() => {
    if (!open) return
    fetchProxyPolicy()
  }, [fetchProxyPolicy, open])

  useEffect(() => {
    if (!open) return
    fetchContent()
    fetchProfile()
    getInterfaceNameList()
  }, [fetchContent, fetchProfile, getInterfaceNameList, open])

  useEffect(() => {
    return () => {
      editorRef.current?.dispose()
      editorRef.current = null
    }
  }, [])

  const validateGroup = () => {
    const group = formIns.getValues()
    if (group.name === '') {
      throw new Error(t('profiles.modals.groupsEditor.errors.nameRequired'))
    }
  }

  const handleSave = useLockFn(async () => {
    try {
      const nextData = visualization
        ? buildGroupsYaml(prependSeq, appendSeq, deleteSeq)
        : currData

      if (visualization) {
        setCurrData(nextData)
      }

      const result = await mutate(() => saveProfileFile(property, nextData), {
        id: `save-profile-file:${property}`,
        errorNotice: false,
      })
      if (!(result.ok && result.value === true)) {
        await fetchContent()
        onClose()
        return
      }
      showNotice.success('shared.feedback.notifications.saved')
      setPrevData(nextData)
      onSave?.(prevData, nextData)
      onClose()
    } catch (err) {
      showNotice.error(err)
    }
  })

  const renderNumberInput = (
    id: string,
    placeholder: string | undefined,
    onChange: (value: number) => void,
    unit?: string,
  ) =>
    unit ? (
      <InputGroup>
        <InputGroupInput
          id={id}
          autoComplete="new-password"
          placeholder={placeholder}
          type="number"
          onChange={(e) => onChange(parseIntValue(e.target.value))}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{unit}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    ) : (
      <Input
        id={id}
        autoComplete="new-password"
        placeholder={placeholder}
        type="number"
        onChange={(e) => onChange(parseIntValue(e.target.value))}
      />
    )

  const onAddGroup = (position: 'prepend' | 'append') => {
    try {
      validateGroup()
      const list = position === 'prepend' ? prependSeq : appendSeq
      for (const item of [...list, ...groupList]) {
        if (item.name === formIns.getValues().name) {
          throw new Error(t('profiles.modals.groupsEditor.errors.nameExists'))
        }
      }
      if (position === 'prepend') {
        setPrependSeq([formIns.getValues(), ...prependSeq])
      } else {
        setAppendSeq([...appendSeq, formIns.getValues()])
      }
    } catch (err) {
      showNotice.error(err)
    }
  }

  return (
    <EditorDialog
      open={open}
      title={t('profiles.modals.groupsEditor.title')}
      onClose={onClose}
      actions={
        <Tabs
          value={visualization ? 'visualization' : 'advanced'}
          onValueChange={(next) => {
            if ((next === 'visualization') !== visualization) {
              handleVisualizationToggle()
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="visualization">
              {t('shared.editorModes.visualization')}
            </TabsTrigger>
            <TabsTrigger value="advanced">
              {t('shared.editorModes.advanced')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('shared.actions.cancel')}
          </Button>
          <Button onClick={handleSave}>{t('shared.actions.save')}</Button>
        </>
      }
    >
      {visualization ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="min-h-0 flex-1 overflow-y-auto pe-2">
              <FieldGroup className="gap-2.5">
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t('profiles.modals.groupsEditor.fields.type')}
                    >
                      <Select
                        value={field.value}
                        onValueChange={(value) =>
                          value && field.onChange(value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GROUP_STRATEGIES.map((option) => (
                            <SelectItem
                              key={option}
                              value={option}
                              title={translateStrategy(option)}
                            >
                              {translateStrategy(option)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormRow>
                  )}
                />
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t('profiles.modals.groupsEditor.fields.name')}
                      htmlFor="group-name"
                    >
                      <Input
                        id="group-name"
                        autoComplete="new-password"
                        {...field}
                        value={field.value ?? ''}
                        aria-invalid={field.value === ''}
                        required
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  name="icon"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t('profiles.modals.groupsEditor.fields.icon')}
                      htmlFor="group-icon"
                    >
                      <Input
                        id="group-icon"
                        autoComplete="new-password"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  name="proxies"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t('profiles.modals.groupsEditor.fields.proxies')}
                    >
                      <EditorCombobox
                        multiple
                        options={proxyPolicyList}
                        getLabel={translatePolicy}
                        value={field.value ?? []}
                        onChange={(value) => value && field.onChange(value)}
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  name="use"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t('profiles.modals.groupsEditor.fields.provider')}
                    >
                      <EditorCombobox
                        multiple
                        options={proxyProviderList}
                        value={field.value ?? []}
                        onChange={(value) => value && field.onChange(value)}
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  name="url"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t(
                        'profiles.modals.groupsEditor.fields.healthCheckUrl',
                      )}
                      htmlFor="group-url"
                    >
                      <Input
                        id="group-url"
                        autoComplete="new-password"
                        placeholder="http://cp.cloudflare.com/generate_204"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  name="expected-status"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t(
                        'profiles.modals.groupsEditor.fields.expectedStatus',
                      )}
                      htmlFor="group-expected-status"
                    >
                      <Input
                        id="group-expected-status"
                        autoComplete="new-password"
                        placeholder="*"
                        onChange={(e) => {
                          field.onChange(parseIntValue(e.target.value))
                        }}
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  name="interval"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t('profiles.modals.groupsEditor.fields.interval')}
                      htmlFor="group-interval"
                    >
                      {renderNumberInput(
                        'group-interval',
                        '300',
                        field.onChange,
                        t('shared.units.seconds'),
                      )}
                    </FormRow>
                  )}
                />
                <Controller
                  name="timeout"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t('shared.labels.timeout')}
                      htmlFor="group-timeout"
                    >
                      {renderNumberInput(
                        'group-timeout',
                        '5000',
                        field.onChange,
                        t('shared.units.milliseconds'),
                      )}
                    </FormRow>
                  )}
                />
                <Controller
                  name="max-failed-times"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t(
                        'profiles.modals.groupsEditor.fields.maxFailedTimes',
                      )}
                      htmlFor="group-max-failed-times"
                    >
                      {renderNumberInput(
                        'group-max-failed-times',
                        '5',
                        field.onChange,
                      )}
                    </FormRow>
                  )}
                />
                <Controller
                  name="interface-name"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t(
                        'profiles.modals.groupsEditor.fields.interfaceName',
                      )}
                    >
                      <EditorCombobox
                        options={interfaceNameList}
                        value={field.value}
                        onChange={(value) => value && field.onChange(value)}
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  name="routing-mark"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t(
                        'profiles.modals.groupsEditor.fields.routingMark',
                      )}
                      htmlFor="group-routing-mark"
                    >
                      {renderNumberInput(
                        'group-routing-mark',
                        undefined,
                        field.onChange,
                      )}
                    </FormRow>
                  )}
                />
                <Controller
                  name="filter"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t('profiles.modals.groupsEditor.fields.filter')}
                      htmlFor="group-filter"
                    >
                      <Input
                        id="group-filter"
                        autoComplete="new-password"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  name="exclude-filter"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t(
                        'profiles.modals.groupsEditor.fields.excludeFilter',
                      )}
                      htmlFor="group-exclude-filter"
                    >
                      <Input
                        id="group-exclude-filter"
                        autoComplete="new-password"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  name="exclude-type"
                  control={control}
                  render={({ field }) => (
                    <FormRow
                      label={t(
                        'profiles.modals.groupsEditor.fields.excludeType',
                      )}
                    >
                      <EditorCombobox
                        multiple
                        options={EXCLUDE_TYPES}
                        value={field.value ? field.value.split('|') : []}
                        onChange={(value) => {
                          field.onChange(value.join('|'))
                        }}
                      />
                    </FormRow>
                  )}
                />
                <Controller
                  name="include-all"
                  control={control}
                  render={({ field }) => (
                    <SwitchRow
                      id="group-include-all"
                      label={t(
                        'profiles.modals.groupsEditor.fields.includeAll',
                      )}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="include-all-proxies"
                  control={control}
                  render={({ field }) => (
                    <SwitchRow
                      id="group-include-all-proxies"
                      label={t(
                        'profiles.modals.groupsEditor.fields.includeAllProxies',
                      )}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="include-all-providers"
                  control={control}
                  render={({ field }) => (
                    <SwitchRow
                      id="group-include-all-providers"
                      label={t(
                        'profiles.modals.groupsEditor.fields.includeAllProviders',
                      )}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="lazy"
                  control={control}
                  render={({ field }) => (
                    <SwitchRow
                      id="group-lazy"
                      label={t('profiles.modals.groupsEditor.toggles.lazy')}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="disable-udp"
                  control={control}
                  render={({ field }) => (
                    <SwitchRow
                      id="group-disable-udp"
                      label={t(
                        'profiles.modals.groupsEditor.toggles.disableUdp',
                      )}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  name="hidden"
                  control={control}
                  render={({ field }) => (
                    <SwitchRow
                      id="group-hidden"
                      label={t('profiles.modals.groupsEditor.toggles.hidden')}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </FieldGroup>
            </div>
            <Button className="w-full" onClick={() => onAddGroup('prepend')}>
              <ArrowUpToLineIcon data-icon="inline-start" />
              {t('profiles.modals.groupsEditor.actions.prepend')}
            </Button>
            <Button className="w-full" onClick={() => onAddGroup('append')}>
              <ArrowDownToLineIcon data-icon="inline-start" />
              {t('profiles.modals.groupsEditor.actions.append')}
            </Button>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <BaseSearchBox onSearch={(match) => setMatch(() => match)} />
            <GroupedVirtualList
              items={items}
              renderItem={renderItem}
              onReorder={onReorder}
              style={{ flex: '1 1 0', minHeight: 0 }}
            />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
          <MonacoEditor
            height="100%"
            language="yaml"
            value={currData}
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
            onChange={(value) => setCurrData(value ?? '')}
          />
        </div>
      )}
    </EditorDialog>
  )
}
