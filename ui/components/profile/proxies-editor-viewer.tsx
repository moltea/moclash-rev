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
import type { MonacoEditorInstance } from '@/types/monaco'
import { MONACO_FONT_FAMILY } from '@/utils/font-family'
import parseUri from '@/utils/uri-parser'
import { parseYamlSafe } from '@/utils/yaml'
import { BaseSearchBox, MonacoEditor } from '@ui/components/base'
import { ProxyItem } from '@ui/components/profile/proxy-item'
import { Button } from '@ui/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@ui/components/ui/tabs'
import { Textarea } from '@ui/components/ui/textarea'

import { EditorDialog } from './editor-dialog'
import {
  buildGroupedItems,
  type GroupedVirtualItem,
  GroupedVirtualList,
} from './grouped-virtual-list'

interface Props {
  profileUid: string
  property: string
  open: boolean
  onClose: () => void
  onSave?: (prev?: string, curr?: string) => void
}

const findRealIndex = (
  list: IProxyConfig[],
  filtered: IProxyConfig[],
  filteredIndex: number,
): number => {
  const item = filtered[filteredIndex]
  if (!item) return -1
  return list.findIndex((proxy) => proxy.name === item.name)
}

const hasValidName = (proxy: IProxyConfig) =>
  typeof proxy?.name === 'string' && proxy.name.length > 0

export const ProxiesEditorViewer = (props: Props) => {
  const { profileUid, property, open, onClose, onSave } = props
  const { t } = useTranslation()
  const themeMode = useThemeMode()
  const editorRef = useRef<MonacoEditorInstance | null>(null)
  const [prevData, setPrevData] = useState('')
  const [currData, setCurrData] = useState('')
  const [visualization, setVisualization] = useState(true)
  const [match, setMatch] = useState(() => (_: string) => true)
  const [proxyUri, setProxyUri] = useState<string>('')

  const [proxyList, setProxyList] = useState<IProxyConfig[]>([])
  const [prependSeq, setPrependSeq] = useState<IProxyConfig[]>([])
  const [appendSeq, setAppendSeq] = useState<IProxyConfig[]>([])
  const [deleteSeq, setDeleteSeq] = useState<string[]>([])
  const hasLoadedSeqConfigRef = useRef(false)

  const filteredPrependSeq = useMemo(
    () =>
      prependSeq.filter((proxy) => hasValidName(proxy) && match(proxy.name)),
    [prependSeq, match],
  )
  const filteredProxyList = useMemo(
    () => proxyList.filter((proxy) => hasValidName(proxy) && match(proxy.name)),
    [proxyList, match],
  )
  const filteredAppendSeq = useMemo(
    () => appendSeq.filter((proxy) => hasValidName(proxy) && match(proxy.name)),
    [appendSeq, match],
  )

  const items = useMemo(
    () =>
      buildGroupedItems(
        filteredPrependSeq,
        filteredProxyList,
        filteredAppendSeq,
        (proxy) => proxy.name,
      ),
    [filteredPrependSeq, filteredProxyList, filteredAppendSeq],
  )

  const renderItem = (entry: GroupedVirtualItem<IProxyConfig>) => {
    const { category, item } = entry

    if (category === 'original') {
      const isDeleted = deleteSeq.includes(item.name)
      return (
        <ProxyItem
          type={isDeleted ? 'delete' : 'original'}
          proxy={item}
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
        <ProxyItem
          type="prepend"
          proxy={item}
          onDelete={() => {
            setPrependSeq(prependSeq.filter((v) => v.name !== item.name))
          }}
        />
      )
    }

    return (
      <ProxyItem
        type="append"
        proxy={item}
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

  const handleParseAsync = (cb: (proxies: IProxyConfig[]) => void) => {
    const proxies: IProxyConfig[] = []
    const names: string[] = []
    let uris: string
    try {
      uris = atob(proxyUri)
    } catch {
      uris = proxyUri
    }
    const lines = uris.trim().split('\n')
    let idx = 0
    const batchSize = 50
    let parseTimer: number | undefined

    const parseBatch = () => {
      const end = Math.min(idx + batchSize, lines.length)
      for (; idx < end; idx++) {
        const uri = lines[idx]
        try {
          const proxy = parseUri(uri.trim())
          if (!names.includes(proxy.name)) {
            proxies.push(proxy)
            names.push(proxy.name)
          }
        } catch (err) {
          console.warn(
            '[ProxiesEditorViewer] parseUri failed for line:',
            uri,
            err,
          )
        }
      }
      if (idx < lines.length) {
        parseTimer = window.setTimeout(parseBatch, 0)
      } else {
        if (parseTimer !== undefined) {
          clearTimeout(parseTimer)
          parseTimer = undefined
        }
        cb(proxies)
      }
    }
    parseBatch()
  }
  const fetchProfile = useCallback(async () => {
    const data = await readProfileFile(profileUid)

    const originProxiesObj = parseYamlSafe(data) as {
      proxies: IProxyConfig[]
    } | null

    setProxyList(originProxiesObj?.proxies || [])
  }, [profileUid])

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
    if (
      !hasLoadedSeqConfigRef.current ||
      !(prependSeq && appendSeq && deleteSeq)
    ) {
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
      } catch (e) {
        console.warn('[ProxiesEditorViewer] yaml.dump failed:', e)
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
    } catch (err) {
      showNotice.error(err)
    }
  })

  return (
    <EditorDialog
      open={open}
      title={t('profiles.modals.proxiesEditor.title')}
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
            <Textarea
              autoComplete="new-password"
              placeholder={t(
                'profiles.modals.proxiesEditor.placeholders.multiUri',
              )}
              rows={9}
              className="min-h-0 flex-1 resize-none font-mono [field-sizing:fixed]"
              onChange={(e) => setProxyUri(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={() => {
                handleParseAsync((proxies) => {
                  setPrependSeq((prev) => [...proxies, ...prev])
                })
              }}
            >
              <ArrowUpToLineIcon data-icon="inline-start" />
              {t('profiles.modals.proxiesEditor.actions.prepend')}
            </Button>
            <Button
              className="w-full"
              onClick={() => {
                handleParseAsync((proxies) => {
                  setAppendSeq((prev) => [...prev, ...proxies])
                })
              }}
            >
              <ArrowDownToLineIcon data-icon="inline-start" />
              {t('profiles.modals.proxiesEditor.actions.append')}
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
