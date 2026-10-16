import { arrayMove } from '@dnd-kit/helpers'
import { useLockFn } from 'ahooks'
import * as yaml from 'js-yaml'
import { ArrowDownToLineIcon, ArrowUpToLineIcon } from 'lucide-react'
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { readProfileFile, saveProfileFile } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { useThemeMode } from '@/services/states'
import type { TranslationKey } from '@/types/generated/i18n-keys'
import type { MonacoEditorInstance } from '@/types/monaco'
import { MONACO_FONT_FAMILY } from '@/utils/font-family'
import getSystem from '@/utils/get-system'
import { isValidIpCidr } from '@/utils/network'
import { parseYamlSafe } from '@/utils/yaml'
import { BaseSearchBox, MonacoEditor } from '@ui/components/base'
import { RuleItem } from '@ui/components/profile/rule-item'
import { Button } from '@ui/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'
import { Switch } from '@ui/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/ui/tabs'
import { cn } from '@ui/lib/utils'

import { EditorCombobox } from './editor-combobox'
import { EditorDialog } from './editor-dialog'
import {
  buildGroupedItems,
  type GroupedVirtualItem,
  GroupedVirtualList,
} from './grouped-virtual-list'

interface Props {
  groupsUid: string
  mergeUid: string
  profileUid: string
  property: string
  open: boolean
  onClose: () => void
  onSave?: (prev?: string, curr?: string) => void
}

const portValidator = (value: string): boolean => {
  return new RegExp(
    '^(?:[1-9]\\d{0,3}|[1-5]\\d{4}|6[0-4]\\d{3}|65[0-4]\\d{2}|655[0-2]\\d|6553[0-5])$',
  ).test(value)
}

const rules: {
  name: string
  required?: boolean
  example?: string
  noResolve?: boolean
  validator?: (value: string) => boolean
}[] = [
  {
    name: 'DOMAIN',
    example: 'example.com',
  },
  {
    name: 'DOMAIN-SUFFIX',
    example: 'example.com',
  },
  {
    name: 'DOMAIN-KEYWORD',
    example: 'example',
  },
  {
    name: 'DOMAIN-REGEX',
    example: 'example.*',
  },
  {
    name: 'GEOSITE',
    example: 'youtube',
  },
  {
    name: 'GEOIP',
    example: 'CN',
    noResolve: true,
  },
  {
    name: 'SRC-GEOIP',
    example: 'CN',
  },
  {
    name: 'IP-ASN',
    example: '13335',
    noResolve: true,
    validator: (value) => (+value ? true : false),
  },
  {
    name: 'SRC-IP-ASN',
    example: '9808',
    validator: (value) => (+value ? true : false),
  },
  {
    name: 'IP-CIDR',
    example: '127.0.0.0/8',
    noResolve: true,
    validator: isValidIpCidr,
  },
  {
    name: 'IP-CIDR6',
    example: '2620:0:2d0:200::7/32',
    noResolve: true,
    validator: isValidIpCidr,
  },
  {
    name: 'SRC-IP-CIDR',
    example: '192.168.1.201/32',
    validator: isValidIpCidr,
  },
  {
    name: 'IP-SUFFIX',
    example: '8.8.8.8/24',
    noResolve: true,
    validator: isValidIpCidr,
  },
  {
    name: 'SRC-IP-SUFFIX',
    example: '192.168.1.201/8',
    validator: isValidIpCidr,
  },
  {
    name: 'SRC-PORT',
    example: '7777',
    validator: (value) => portValidator(value),
  },
  {
    name: 'DST-PORT',
    example: '80',
    validator: (value) => portValidator(value),
  },
  {
    name: 'IN-PORT',
    example: '7897',
    validator: (value) => portValidator(value),
  },
  {
    name: 'DSCP',
    example: '4',
  },
  {
    name: 'PROCESS-NAME',
    example: getSystem() === 'windows' ? 'chrome.exe' : 'curl',
  },
  {
    name: 'PROCESS-PATH',
    example:
      getSystem() === 'windows'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/wget',
  },
  {
    name: 'PROCESS-NAME-REGEX',
    example: '.*telegram.*',
  },
  {
    name: 'PROCESS-PATH-REGEX',
    example:
      getSystem() === 'windows' ? '(?i).*Application\\chrome.*' : '.*bin/wget',
  },
  {
    name: 'NETWORK',
    example: 'udp',
    validator: (value) => ['tcp', 'udp'].includes(value),
  },
  {
    name: 'UID',
    example: '1001',
    validator: (value) => (+value ? true : false),
  },
  {
    name: 'IN-TYPE',
    example: 'SOCKS/HTTP',
  },
  {
    name: 'IN-USER',
    example: 'mihomo',
  },
  {
    name: 'IN-NAME',
    example: 'ss',
  },
  {
    name: 'SUB-RULE',
    example: '(NETWORK,tcp)',
  },
  {
    name: 'RULE-SET',
    example: 'providername',
    noResolve: true,
  },
  {
    name: 'AND',
    example: '((DOMAIN,baidu.com),(NETWORK,UDP))',
  },
  {
    name: 'OR',
    example: '((NETWORK,UDP),(DOMAIN,baidu.com))',
  },
  {
    name: 'NOT',
    example: '((DOMAIN,baidu.com))',
  },
  {
    name: 'MATCH',
    required: false,
  },
]

const RULE_TYPE_LABEL_KEYS: Record<string, string> = Object.fromEntries(
  rules.map((rule) => [
    rule.name,
    `rules.modals.editor.ruleTypes.${rule.name}`,
  ]),
)

const builtinProxyPolicies = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']

const PROXY_POLICY_LABEL_KEYS: Record<string, TranslationKey> =
  builtinProxyPolicies.reduce(
    (acc, policy) => {
      acc[policy] =
        `proxies.components.enums.policies.${policy}` as TranslationKey
      return acc
    },
    {} as Record<string, TranslationKey>,
  )

const findRealIndex = (
  list: string[],
  filtered: string[],
  filteredIndex: number,
): number => {
  const item = filtered[filteredIndex]
  if (item === undefined) return -1
  return list.indexOf(item)
}

export const RulesEditorViewer = (props: Props) => {
  const { groupsUid, mergeUid, profileUid, property, open, onClose, onSave } =
    props
  const { t } = useTranslation()
  const themeMode = useThemeMode()

  const editorRef = useRef<MonacoEditorInstance | null>(null)

  const [prevData, setPrevData] = useState('')
  const [currData, setCurrData] = useState('')
  const [visualization, setVisualization] = useState(true)
  const [match, setMatch] = useState(() => (_: string) => true)

  const [ruleType, setRuleType] = useState<(typeof rules)[number]>(rules[0])
  const [ruleContent, setRuleContent] = useState('')
  const [noResolve, setNoResolve] = useState(false)
  const [proxyPolicy, setProxyPolicy] = useState(builtinProxyPolicies[0])
  const [proxyPolicyList, setProxyPolicyList] = useState<string[]>([])
  const [ruleList, setRuleList] = useState<string[]>([])
  const [ruleSetList, setRuleSetList] = useState<string[]>([])
  const [subRuleList, setSubRuleList] = useState<string[]>([])

  const [prependSeq, setPrependSeq] = useState<string[]>([])
  const [appendSeq, setAppendSeq] = useState<string[]>([])
  const [deleteSeq, setDeleteSeq] = useState<string[]>([])
  const hasLoadedSeqConfigRef = useRef(false)

  const filteredPrependSeq = useMemo(
    () => prependSeq.filter((rule) => match(rule)),
    [prependSeq, match],
  )
  const filteredRuleList = useMemo(
    () => ruleList.filter((rule) => match(rule)),
    [ruleList, match],
  )
  const filteredAppendSeq = useMemo(
    () => appendSeq.filter((rule) => match(rule)),
    [appendSeq, match],
  )

  const items = useMemo(
    () =>
      buildGroupedItems(
        filteredPrependSeq,
        filteredRuleList,
        filteredAppendSeq,
        (rule) => rule,
      ),
    [filteredPrependSeq, filteredRuleList, filteredAppendSeq],
  )

  const renderItem = (entry: GroupedVirtualItem<string>) => {
    const { category, item } = entry

    if (category === 'original') {
      const isDeleted = deleteSeq.includes(item)
      return (
        <RuleItem
          type={isDeleted ? 'delete' : 'original'}
          ruleRaw={item}
          onDelete={() => {
            if (isDeleted) {
              setDeleteSeq(deleteSeq.filter((v) => v !== item))
            } else {
              setDeleteSeq((prev) => [...prev, item])
            }
          }}
        />
      )
    }

    if (category === 'prepend') {
      return (
        <RuleItem
          type="prepend"
          ruleRaw={item}
          onDelete={() => {
            setPrependSeq(prependSeq.filter((v) => v !== item))
          }}
          onAppend={() => {
            setAppendSeq((prev) =>
              prev.includes(item) ? prev : [...prev, item],
            )
            setPrependSeq(prependSeq.filter((v) => v !== item))
          }}
        />
      )
    }

    return (
      <RuleItem
        type="append"
        ruleRaw={item}
        onDelete={() => {
          setAppendSeq(appendSeq.filter((v) => v !== item))
        }}
        onPrepend={() => {
          setPrependSeq((prev) =>
            prev.includes(item) ? prev : [...prev, item],
          )
          setAppendSeq(appendSeq.filter((v) => v !== item))
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
    setDeleteSeq(obj?.delete || [])
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
      setDeleteSeq(obj?.delete ?? [])
    })
    setVisualization(true)
  }

  useEffect(() => {
    if (!hasLoadedSeqConfigRef.current) {
      return
    }

    if (!(prependSeq && appendSeq && deleteSeq)) {
      return
    }

    const serialize = () => {
      if (!hasLoadedSeqConfigRef.current) {
        return
      }

      try {
        setCurrData(
          yaml.dump(
            { prepend: prependSeq, append: appendSeq, delete: deleteSeq },
            { forceQuotes: true },
          ),
        )
      } catch (error) {
        showNotice.error(error ?? 'YAML dump error')
      }
    }
    let idleId: number | undefined
    let timeoutId: number | undefined
    if (window.requestIdleCallback) {
      idleId = window.requestIdleCallback(serialize)
    } else {
      timeoutId = window.setTimeout(serialize, 0)
    }
    return () => {
      if (idleId !== undefined && window.cancelIdleCallback) {
        window.cancelIdleCallback(idleId)
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
    }
  }, [prependSeq, appendSeq, deleteSeq])

  const fetchProfile = useCallback(async () => {
    const data = await readProfileFile(profileUid)
    const groupsData = await readProfileFile(groupsUid)
    const mergeData = await readProfileFile(mergeUid)
    const globalMergeData = await readProfileFile('Merge')

    const rulesObj = parseYamlSafe(data) as { rules: [] } | null

    const originGroupsObj = parseYamlSafe(data) as {
      'proxy-groups': IProxyGroupConfig[]
    } | null
    const originGroups = originGroupsObj?.['proxy-groups'] || []
    const moreGroupsObj = parseYamlSafe(groupsData) as ISeqProfileConfig | null
    const rawPrependGroups = moreGroupsObj?.['prepend']
    const morePrependGroups = Array.isArray(rawPrependGroups)
      ? (rawPrependGroups as IProxyGroupConfig[])
      : []
    const rawAppendGroups = moreGroupsObj?.['append']
    const moreAppendGroups = Array.isArray(rawAppendGroups)
      ? (rawAppendGroups as IProxyGroupConfig[])
      : []
    const rawDeleteGroups = moreGroupsObj?.['delete']
    const moreDeleteGroups: Array<string | { name: string }> = Array.isArray(
      rawDeleteGroups,
    )
      ? (rawDeleteGroups as Array<string | { name: string }>)
      : []
    const groups = morePrependGroups.concat(
      originGroups.filter((group: any) => {
        if (group.name) {
          return !moreDeleteGroups.includes(group.name)
        } else {
          return !moreDeleteGroups.includes(group)
        }
      }),
      moreAppendGroups,
    )

    const originRuleSetObj = parseYamlSafe(data) as {
      'rule-providers': Record<string, unknown>
    } | null
    const originRuleSet = originRuleSetObj?.['rule-providers'] || {}
    const moreRuleSetObj = parseYamlSafe(mergeData) as {
      'rule-providers': Record<string, unknown>
    } | null
    const moreRuleSet = moreRuleSetObj?.['rule-providers'] || {}
    const globalRuleSetObj = parseYamlSafe(globalMergeData) as {
      'rule-providers': Record<string, unknown>
    } | null
    const globalRuleSet = globalRuleSetObj?.['rule-providers'] || {}
    const ruleSet = Object.assign({}, originRuleSet, moreRuleSet, globalRuleSet)

    const originSubRuleObj = parseYamlSafe(data) as {
      'sub-rules': Record<string, unknown>
    } | null
    const originSubRule = originSubRuleObj?.['sub-rules'] || {}
    const moreSubRuleObj = parseYamlSafe(mergeData) as {
      'sub-rules': Record<string, unknown>
    } | null
    const moreSubRule = moreSubRuleObj?.['sub-rules'] || {}
    const globalSubRuleObj = parseYamlSafe(globalMergeData) as {
      'sub-rules': Record<string, unknown>
    } | null
    const globalSubRule = globalSubRuleObj?.['sub-rules'] || {}
    const subRule = Object.assign({}, originSubRule, moreSubRule, globalSubRule)
    setProxyPolicyList(
      builtinProxyPolicies.concat(groups.map((group: any) => group.name)),
    )
    setRuleSetList(Object.keys(ruleSet))
    setSubRuleList(Object.keys(subRule))
    setRuleList(rulesObj?.rules || [])
  }, [groupsUid, mergeUid, profileUid])

  useEffect(() => {
    if (!open) return
    fetchContent()
    fetchProfile()
  }, [fetchContent, fetchProfile, open])

  useEffect(() => {
    return () => {
      editorRef.current?.dispose()
      editorRef.current = null
    }
  }, [])

  const validateRule = () => {
    if ((ruleType.required ?? true) && !ruleContent) {
      throw new Error(
        t('rules.modals.editor.form.validation.conditionRequired'),
      )
    }
    if (ruleType.validator && !ruleType.validator(ruleContent)) {
      throw new Error(t('rules.modals.editor.form.validation.invalidRule'))
    }

    const condition = (ruleType.required ?? true) ? ruleContent : ''
    return `${ruleType.name}${condition ? ',' + condition : ''},${proxyPolicy}${
      ruleType.noResolve && noResolve ? ',no-resolve' : ''
    }`
  }

  const handleSave = useLockFn(async () => {
    try {
      const result = await mutate(() => saveProfileFile(property, currData), {
        id: `save-profile-file:${property}`,
        errorNotice: false,
      })
      if (!(result.ok && result.value === true)) {
        await fetchContent()
        onClose()
        return
      }
      showNotice.success('shared.feedback.notifications.saved')
      onSave?.(prevData, currData)
      onClose()
    } catch (err: any) {
      showNotice.error(err)
    }
  })

  const ruleTypeLabel = (name: string) => t(RULE_TYPE_LABEL_KEYS[name] ?? name)
  const proxyPolicyLabel = (option: string) =>
    t(PROXY_POLICY_LABEL_KEYS[option] ?? option)

  return (
    <EditorDialog
      open={open}
      title={t('rules.modals.editor.title')}
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
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pe-2">
            <FieldGroup className="gap-2.5">
              <Field orientation="horizontal">
                <FieldLabel>
                  {t('rules.modals.editor.form.labels.type')}
                </FieldLabel>
                <div className="w-3/5 shrink-0">
                  <EditorCombobox
                    options={rules.map((rule) => rule.name)}
                    getLabel={ruleTypeLabel}
                    value={ruleType.name}
                    onChange={(name) => {
                      const next = rules.find((rule) => rule.name === name)
                      if (next) setRuleType(next)
                    }}
                  />
                </div>
              </Field>
              <Field
                orientation="horizontal"
                className={cn(!(ruleType.required ?? true) && 'hidden')}
              >
                <FieldLabel htmlFor="rule-content">
                  {t('rules.modals.editor.form.labels.content')}
                </FieldLabel>
                <div className="w-3/5 shrink-0">
                  {ruleType.name === 'RULE-SET' && (
                    <EditorCombobox
                      options={ruleSetList}
                      value={ruleContent}
                      onChange={(value) => value && setRuleContent(value)}
                    />
                  )}
                  {ruleType.name === 'SUB-RULE' && (
                    <EditorCombobox
                      options={subRuleList}
                      value={ruleContent}
                      onChange={(value) => value && setRuleContent(value)}
                    />
                  )}
                  {ruleType.name !== 'RULE-SET' &&
                    ruleType.name !== 'SUB-RULE' && (
                      <Input
                        id="rule-content"
                        autoComplete="new-password"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={ruleContent}
                        required={ruleType.required ?? true}
                        aria-invalid={
                          (ruleType.required ?? true) && !ruleContent
                        }
                        placeholder={ruleType.example}
                        onChange={(e) => setRuleContent(e.target.value)}
                      />
                    )}
                </div>
              </Field>
              <Field orientation="horizontal">
                <FieldLabel>
                  {t('rules.modals.editor.form.labels.proxyPolicy')}
                </FieldLabel>
                <div className="w-3/5 shrink-0">
                  <EditorCombobox
                    options={proxyPolicyList}
                    getLabel={proxyPolicyLabel}
                    value={proxyPolicy}
                    onChange={(value) => value && setProxyPolicy(value)}
                  />
                </div>
              </Field>
              {ruleType.noResolve && (
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="rule-no-resolve">
                    {t('rules.modals.editor.form.toggles.noResolve')}
                  </FieldLabel>
                  <Switch
                    id="rule-no-resolve"
                    checked={noResolve}
                    onCheckedChange={() => setNoResolve(!noResolve)}
                  />
                </Field>
              )}
            </FieldGroup>
            <Button
              className="w-full"
              onClick={() => {
                try {
                  const raw = validateRule()
                  if (prependSeq.includes(raw)) return
                  setPrependSeq([raw, ...prependSeq])
                } catch (err: any) {
                  showNotice.error(err)
                }
              }}
            >
              <ArrowUpToLineIcon data-icon="inline-start" />
              {t('rules.modals.editor.form.actions.prependRule')}
            </Button>
            <Button
              className="w-full"
              onClick={() => {
                try {
                  const raw = validateRule()
                  if (appendSeq.includes(raw)) return
                  setAppendSeq([...appendSeq, raw])
                } catch (err: any) {
                  showNotice.error(err)
                }
              }}
            >
              <ArrowDownToLineIcon data-icon="inline-start" />
              {t('rules.modals.editor.form.actions.appendRule')}
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
