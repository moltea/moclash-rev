import { useSortable } from '@dnd-kit/react/sortable'
import { useLockFn } from 'ahooks'
import dayjs from 'dayjs'
import {
  EllipsisVerticalIcon,
  GripVerticalIcon,
  RefreshCwIcon,
} from 'lucide-react'
import {
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useEditorDocument } from '@/hooks/use-editor-document'
import {
  getNextUpdateTime,
  readProfileFile,
  saveProfileFile,
  updateProfile,
  viewProfile,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import {
  useProfileLoadingCache,
  useSetProfileLoading,
} from '@/store/app-store-context'
import type { TranslationKey } from '@/types/generated/i18n-keys'
import { debugLog } from '@/utils/debug'
import { isValidUrl } from '@/utils/network'
import { openExternalUrl } from '@/utils/open-external-url'
import parseTraffic from '@/utils/parse-traffic'
import { EditorViewer } from '@ui/components/profile/editor-viewer'
import { GroupsEditorViewer } from '@ui/components/profile/groups-editor-viewer'
import { RulesEditorViewer } from '@ui/components/profile/rules-editor-viewer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@ui/components/ui/alert-dialog'
import { Button } from '@ui/components/ui/button'
import { Checkbox } from '@ui/components/ui/checkbox'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@ui/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/components/ui/dropdown-menu'
import { Progress } from '@ui/components/ui/progress'
import { Spinner } from '@ui/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

import { EnhanceHint } from './enhance-hint'
import { ProfileBox } from './profile-box'
import { ProxiesEditorViewer } from './proxies-editor-viewer'
import { QrViewer } from './qr-viewer'

export interface ProfileItemProps {
  id: string
  index: number
  selected: boolean
  activating: boolean
  itemData: IProfileItem
  mutateProfiles: () => Promise<void>
  onSelect: (force: boolean) => void
  onEdit: () => void
  onSave?: (prev?: string, curr?: string) => void
  onDelete: () => void
  batchMode?: boolean
  isSelected?: boolean
  onSelectionChange?: () => void
  timerUpdateRevision: number
  completedUpdateRevision: number
}

const ProfileItemBase = (props: ProfileItemProps) => {
  const {
    id,
    index,
    selected,
    activating,
    itemData,
    mutateProfiles,
    onSelect,
    onEdit,
    onSave,
    onDelete,
    batchMode,
    isSelected,
    onSelectionChange,
    timerUpdateRevision,
    completedUpdateRevision,
  } = props

  const [element, setElement] = useState<Element | null>(null)
  const handleRef = useRef<HTMLSpanElement | null>(null)
  useSortable({
    id,
    index,
    element,
    handle: handleRef,
  })

  const { t } = useTranslation()
  const loadingCache = useProfileLoadingCache()
  const setProfileLoading = useSetProfileLoading()

  const [showNextUpdate, setShowNextUpdate] = useState(false)
  const showNextUpdateRef = useRef(false)
  const [nextUpdateTime, setNextUpdateTime] = useState('')
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const setLoading = useCallback(
    (loading: boolean) => {
      setProfileLoading([itemData.uid!], loading)
    },
    [itemData.uid, setProfileLoading],
  )

  const { uid, name = 'Profile', extra, updated = 0, option } = itemData

  const fetchNextUpdateTimeCallback = useCallback(
    async (forceRefresh = false) => {
      if (
        itemData.option?.update_interval &&
        itemData.option.update_interval > 0
      ) {
        try {
          debugLog(`尝试获取配置 ${itemData.uid} 的下次更新时间`)

          if (forceRefresh) {
            debugLog(`强制刷新定时器任务`)
          }

          const nextUpdate = await getNextUpdateTime(itemData.uid!)
          debugLog(`获取到下次更新时间结果:`, nextUpdate)

          if (nextUpdate) {
            const nextUpdateDate = dayjs(nextUpdate * 1000)
            const now = dayjs()

            if (nextUpdateDate.isBefore(now)) {
              setNextUpdateTime(
                t('profiles.components.profileItem.status.lastUpdateFailed'),
              )
            } else {
              const diffMinutes = nextUpdateDate.diff(now, 'minute')

              if (diffMinutes < 60) {
                if (diffMinutes <= 0) {
                  setNextUpdateTime(
                    `${t('profiles.components.profileItem.status.nextUp')} <1m`,
                  )
                } else {
                  setNextUpdateTime(
                    `${t('profiles.components.profileItem.status.nextUp')} ${diffMinutes}m`,
                  )
                }
              } else {
                const hours = Math.floor(diffMinutes / 60)
                const mins = diffMinutes % 60
                setNextUpdateTime(
                  `${t('profiles.components.profileItem.status.nextUp')} ${hours}h ${mins}m`,
                )
              }
            }
          } else {
            debugLog(`返回的下次更新时间为空`)
            setNextUpdateTime(
              t('profiles.components.profileItem.status.noSchedule'),
            )
          }
        } catch (err) {
          console.error(`获取下次更新时间出错:`, err)
          setNextUpdateTime(t('profiles.components.profileItem.status.unknown'))
        }
      } else {
        debugLog(`该配置未设置更新间隔或间隔为0`)
        setNextUpdateTime(
          t('profiles.components.profileItem.status.autoUpdateDisabled'),
        )
      }
    },
    [itemData.option?.update_interval, itemData.uid, t],
  )
  const fetchNextUpdateTime = useLockFn(fetchNextUpdateTimeCallback)

  const toggleUpdateTimeDisplay = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!showNextUpdate) {
      fetchNextUpdateTime()
    }

    setShowNextUpdate(!showNextUpdate)
  }

  useEffect(() => {
    showNextUpdateRef.current = showNextUpdate
  }, [showNextUpdate])

  useEffect(() => {
    if (showNextUpdate) {
      fetchNextUpdateTime()
    }
  }, [
    fetchNextUpdateTime,
    showNextUpdate,
    itemData.option?.update_interval,
    updated,
  ])

  useEffect(() => {
    if (timerUpdateRevision === 0 || !showNextUpdateRef.current) return

    if (refreshTimeoutRef.current !== undefined) {
      clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = window.setTimeout(() => {
      fetchNextUpdateTime(true)
    }, 1000)

    return () => {
      if (refreshTimeoutRef.current !== undefined) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [fetchNextUpdateTime, timerUpdateRevision])

  useEffect(() => {
    if (completedUpdateRevision === 0 || !showNextUpdateRef.current) return
    fetchNextUpdateTime()
  }, [completedUpdateRevision, fetchNextUpdateTime])

  const hasUrl = !!itemData.url
  const hasExtra = !!extra
  const hasHome = !!itemData.home

  const { upload = 0, download = 0, total = 0 } = extra ?? {}
  const from = parseUrl(itemData.url!)
  const description = itemData.desc
  const expire = parseExpire(extra?.expire)
  const progress = Math.min(
    Math.round(((download + upload) * 100) / (total + 0.01)) + 1,
    100,
  )

  const loading = loadingCache.has(itemData.uid!)

  const [, forceRefresh] = useReducer((value: number) => value + 1, 0)
  useEffect(() => {
    if (!hasUrl) return

    let timer: ReturnType<typeof setTimeout> | undefined

    const handler = () => {
      const now = Date.now()
      const lastUpdate = updated! * 1000
      if (now - lastUpdate >= 24 * 36e5) return

      const wait = now - lastUpdate >= 36e5 ? 30e5 : 5e4

      timer = setTimeout(() => {
        forceRefresh()
        handler()
      }, wait)
    }

    handler()

    return () => {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
    }
  }, [forceRefresh, hasUrl, updated])

  const [fileOpen, setFileOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [proxiesOpen, setProxiesOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [scriptOpen, setScriptOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)

  const loadProfileDocument = useCallback(() => readProfileFile(uid!), [uid])
  const loadMergeDocument = useCallback(
    () => readProfileFile(option?.merge ?? ''),
    [option?.merge],
  )
  const loadScriptDocument = useCallback(
    () => readProfileFile(option?.script ?? ''),
    [option?.script],
  )

  const profileDocument = useEditorDocument({
    open: fileOpen,
    load: loadProfileDocument,
  })
  const mergeDocument = useEditorDocument({
    open: mergeOpen,
    load: loadMergeDocument,
  })
  const scriptDocument = useEditorDocument({
    open: scriptOpen,
    load: loadScriptDocument,
  })

  const onOpenHome = () => {
    if (!itemData.home) return
    void openExternalUrl(itemData.home).catch(showNotice.error)
  }

  const onEditInfo = () => {
    onEdit()
  }

  const onShareQrCode = () => {
    setQrOpen(true)
  }

  const onEditFile = () => {
    setFileOpen(true)
  }

  const onEditRules = () => {
    setRulesOpen(true)
  }

  const onEditProxies = () => {
    setProxiesOpen(true)
  }

  const onEditGroups = () => {
    setGroupsOpen(true)
  }

  const onEditMerge = () => {
    setMergeOpen(true)
  }

  const onEditScript = () => {
    setScriptOpen(true)
  }

  const onForceSelect = () => {
    onSelect(true)
  }

  const onOpenFile = useLockFn(async () => {
    try {
      await mutate(() => viewProfile(itemData.uid!), {
        id: 'view-profile',
        errorNotice: false,
      })
    } catch (err) {
      showNotice.error(err)
    }
  })

  const onUpdate = useLockFn(async (type: 0 | 1 | 2): Promise<void> => {
    setLoading(true)

    const option: Partial<IProfileOption> = {}
    if (type === 0) {
      option.with_proxy = false
      option.self_proxy = false
    } else if (type === 2) {
      if (itemData.option?.self_proxy) {
        option.with_proxy = false
        option.self_proxy = true
      } else {
        option.with_proxy = true
        option.self_proxy = false
      }
    }

    try {
      const payload = Object.keys(option).length > 0 ? option : undefined
      await mutate(() => updateProfile(itemData.uid!, payload), {
        id: `update-profile:${itemData.uid}`,
        errorNotice: false,
      })

      void mutateProfiles()
    } catch {
    } finally {
      setLoading(false)
    }
  })

  type ContextMenuItem = {
    label: string
    handler: () => void
    disabled: boolean
  }

  const menuLabels: Record<string, TranslationKey> = {
    home: 'profiles.components.menu.home',
    select: 'profiles.components.menu.select',
    shareQrCode: 'profiles.components.menu.shareQrCode',
    editInfo: 'profiles.components.menu.editInfo',
    editFile: 'profiles.components.menu.editFile',
    editRules: 'profiles.components.menu.editRules',
    editProxies: 'profiles.components.menu.editProxies',
    editGroups: 'profiles.components.menu.editGroups',
    extendConfig: 'profiles.components.menu.extendConfig',
    extendScript: 'profiles.components.menu.extendScript',
    openFile: 'profiles.components.menu.openFile',
    update: 'profiles.components.menu.update',
    updateViaProxy: 'profiles.components.menu.updateViaProxy',
    delete: 'shared.actions.delete',
  } as const

  const urlModeMenu: ContextMenuItem[] = [
    ...(hasHome
      ? [
          {
            label: menuLabels.home,
            handler: onOpenHome,
            disabled: false,
          } satisfies ContextMenuItem,
        ]
      : []),
    {
      label: menuLabels.select,
      handler: onForceSelect,
      disabled: false,
    },
    {
      label: menuLabels.shareQrCode,
      handler: onShareQrCode,
      disabled: false,
    },
    {
      label: menuLabels.editInfo,
      handler: onEditInfo,
      disabled: false,
    },
    {
      label: menuLabels.editFile,
      handler: onEditFile,
      disabled: false,
    },
    {
      label: menuLabels.editRules,
      handler: onEditRules,
      disabled: !option?.rules,
    },
    {
      label: menuLabels.editProxies,
      handler: onEditProxies,
      disabled: !option?.proxies,
    },
    {
      label: menuLabels.editGroups,
      handler: onEditGroups,
      disabled: !option?.groups,
    },
    {
      label: menuLabels.extendConfig,
      handler: onEditMerge,
      disabled: !option?.merge,
    },
    {
      label: menuLabels.extendScript,
      handler: onEditScript,
      disabled: !option?.script,
    },
    {
      label: menuLabels.openFile,
      handler: onOpenFile,
      disabled: false,
    },
    {
      label: menuLabels.update,
      handler: () => onUpdate(0),
      disabled: false,
    },
    {
      label: menuLabels.updateViaProxy,
      handler: () => onUpdate(2),
      disabled: false,
    },
    {
      label: menuLabels.delete,
      handler: () => {
        if (batchMode) {
          if (onSelectionChange) {
            onSelectionChange()
          }
        } else {
          setConfirmOpen(true)
        }
      },
      disabled: false,
    },
  ]
  const fileModeMenu: ContextMenuItem[] = [
    {
      label: menuLabels.select,
      handler: onForceSelect,
      disabled: false,
    },
    {
      label: menuLabels.editInfo,
      handler: onEditInfo,
      disabled: false,
    },
    {
      label: menuLabels.editFile,
      handler: onEditFile,
      disabled: false,
    },
    {
      label: menuLabels.editRules,
      handler: onEditRules,
      disabled: !option?.rules,
    },
    {
      label: menuLabels.editProxies,
      handler: onEditProxies,
      disabled: !option?.proxies,
    },
    {
      label: menuLabels.editGroups,
      handler: onEditGroups,
      disabled: !option?.groups,
    },
    {
      label: menuLabels.extendConfig,
      handler: onEditMerge,
      disabled: !option?.merge,
    },
    {
      label: menuLabels.extendScript,
      handler: onEditScript,
      disabled: !option?.script,
    },
    {
      label: menuLabels.openFile,
      handler: onOpenFile,
      disabled: false,
    },
    {
      label: menuLabels.delete,
      handler: () => {
        if (batchMode) {
          if (onSelectionChange) {
            onSelectionChange()
          }
        } else {
          setConfirmOpen(true)
        }
      },
      disabled: false,
    },
  ]

  const handleSaveProfileDocument = useLockFn(async () => {
    const currentValue = profileDocument.value
    const result = await mutate(() => saveProfileFile(uid!, currentValue), {
      id: `save-profile-file:${uid}`,
      errorNotice: false,
    })
    if (!(result.ok && result.value === true)) {
      await profileDocument.reload()
      return
    }
    onSave?.(profileDocument.savedValue, currentValue)
    profileDocument.markSaved(currentValue)
  })

  const handleSaveMergeDocument = useLockFn(async () => {
    const mergeUid = option?.merge ?? ''
    const currentValue = mergeDocument.value
    const result = await mutate(() => saveProfileFile(mergeUid, currentValue), {
      id: `save-profile-file:${mergeUid}`,
      errorNotice: false,
    })
    if (!(result.ok && result.value === true)) {
      await mergeDocument.reload()
      return
    }
    onSave?.(mergeDocument.savedValue, currentValue)
    mergeDocument.markSaved(currentValue)
  })

  const handleSaveScriptDocument = useLockFn(async () => {
    const scriptUid = option?.script ?? ''
    const currentValue = scriptDocument.value
    const result = await mutate(
      () => saveProfileFile(scriptUid, currentValue),
      {
        id: `save-profile-file:${scriptUid}`,
        errorNotice: false,
      },
    )
    if (!(result.ok && result.value === true)) {
      await scriptDocument.reload()
      return
    }
    onSave?.(scriptDocument.savedValue, currentValue)
    scriptDocument.markSaved(currentValue)
  })

  const menuItems = hasUrl ? urlModeMenu : fileModeMenu

  const stopMenuEvent = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const updateTimeTitle = showNextUpdate
    ? t('profiles.components.profileItem.tooltips.showLast')
    : `${t('shared.labels.updateTime')}: ${parseExpire(updated!)}\n${t('profiles.components.profileItem.tooltips.showNext')}`

  return (
    <>
      <ContextMenu modal={false}>
        <ContextMenuTrigger asChild>
          <div ref={setElement} className="relative rounded-lg">
            <ProfileBox
              aria-selected={selected}
              className="h-full"
              onClick={(e) => {
                if (!e.currentTarget.contains(e.target as Node)) return
                if (activating) {
                  e.preventDefault()
                  e.stopPropagation()
                  return
                }
                onSelect(false)
              }}
            >
              {activating && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-background/40 backdrop-blur-[2px]">
                  <Spinner className="size-5 text-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-1.5 px-(--card-spacing)">
                <div className="flex min-w-0 items-center gap-1">
                  {batchMode && (
                    <Checkbox
                      className="me-1"
                      checked={!!isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => onSelectionChange?.()}
                    />
                  )}
                  <span
                    ref={handleRef}
                    className="-ms-1 flex shrink-0 cursor-move text-muted-foreground hover:text-foreground"
                  >
                    <GripVerticalIcon className="size-4" />
                  </span>
                  <h2
                    className="min-w-0 flex-1 truncate font-heading text-sm font-semibold text-foreground group-aria-selected/card:text-primary"
                    title={name!}
                  >
                    {name}
                  </h2>
                  {hasUrl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={t('shared.actions.refresh')}
                          disabled={loading}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (activating || loading) {
                              return
                            }
                            onUpdate(1)
                          }}
                        >
                          <RefreshCwIcon
                            className={cn(loading && 'animate-spin')}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('shared.actions.refresh')}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('shared.actions.edit')}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <EllipsisVerticalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-36"
                      onContextMenu={stopMenuEvent}
                    >
                      {menuItems.map((item) => (
                        <MenuEntry
                          key={item.label}
                          item={item}
                          isDelete={item.label === menuLabels.delete}
                          Item={DropdownMenuItem}
                          Separator={DropdownMenuSeparator}
                          label={t(item.label as TranslationKey)}
                        />
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex h-5 min-w-0 items-center justify-between gap-2">
                  {description ? (
                    <span className="truncate" title={description}>
                      {description}
                    </span>
                  ) : (
                    hasUrl && (
                      <span
                        className="truncate"
                        title={`${t('shared.labels.from')} ${from}`}
                      >
                        {from}
                      </span>
                    )
                  )}
                  {hasUrl && (
                    <button
                      type="button"
                      className="ms-auto shrink-0 truncate border-b border-dashed border-transparent transition-colors hover:border-primary hover:text-primary"
                      title={updateTimeTitle}
                      onClick={toggleUpdateTimeDisplay}
                    >
                      {showNextUpdate
                        ? nextUpdateTime
                        : updated! > 0
                          ? dayjs(updated! * 1000).fromNow()
                          : ''}
                    </button>
                  )}
                </div>

                {hasExtra ? (
                  <div className="flex h-5 items-center justify-between gap-2 tabular-nums">
                    <span title={t('shared.labels.usedTotal')}>
                      {parseTraffic(upload + download)} / {parseTraffic(total)}
                    </span>
                    <span title={t('shared.labels.expireTime')}>{expire}</span>
                  </div>
                ) : (
                  <div className="flex h-5 items-center justify-end text-[0.625rem] tabular-nums">
                    <span title={t('shared.labels.updateTime')}>
                      {parseExpire(updated!)}
                    </span>
                  </div>
                )}
                <Progress
                  value={progress}
                  className={cn(total > 0 ? 'opacity-100' : 'opacity-0')}
                />
              </div>
            </ProfileBox>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-36" onContextMenu={stopMenuEvent}>
          {menuItems.map((item) => (
            <MenuEntry
              key={item.label}
              item={item}
              isDelete={item.label === menuLabels.delete}
              Item={ContextMenuItem}
              Separator={ContextMenuSeparator}
              label={t(item.label as TranslationKey)}
            />
          ))}
        </ContextMenuContent>
      </ContextMenu>
      {fileOpen && (
        <EditorViewer
          open={true}
          value={profileDocument.value}
          language="yaml"
          path={`profile:${uid}.yaml`}
          loading={profileDocument.loading}
          dirty={profileDocument.dirty}
          onChange={profileDocument.setValue}
          onSave={handleSaveProfileDocument}
          onClose={() => setFileOpen(false)}
        />
      )}
      {rulesOpen && (
        <RulesEditorViewer
          groupsUid={option?.groups ?? ''}
          mergeUid={option?.merge ?? ''}
          profileUid={uid!}
          property={option?.rules ?? ''}
          open={true}
          onSave={onSave}
          onClose={() => setRulesOpen(false)}
        />
      )}
      {proxiesOpen && (
        <ProxiesEditorViewer
          profileUid={uid!}
          property={option?.proxies ?? ''}
          open={true}
          onSave={onSave}
          onClose={() => setProxiesOpen(false)}
        />
      )}
      {groupsOpen && (
        <GroupsEditorViewer
          mergeUid={option?.merge ?? ''}
          proxiesUid={option?.proxies ?? ''}
          profileUid={uid!}
          property={option?.groups ?? ''}
          open={true}
          onSave={onSave}
          onClose={() => {
            setGroupsOpen(false)
          }}
        />
      )}
      {mergeOpen && (
        <EditorViewer
          open={true}
          title={t('profiles.components.menu.extendConfig')}
          description={<EnhanceHint stage="profileMerge" />}
          value={mergeDocument.value}
          language="yaml"
          path={`merge:${option?.merge ?? ''}.yaml`}
          loading={mergeDocument.loading}
          dirty={mergeDocument.dirty}
          onChange={mergeDocument.setValue}
          onSave={handleSaveMergeDocument}
          onClose={() => setMergeOpen(false)}
        />
      )}
      {scriptOpen && (
        <EditorViewer
          open={true}
          title={t('profiles.components.menu.extendScript')}
          description={<EnhanceHint stage="profileScript" />}
          value={scriptDocument.value}
          language="javascript"
          path={`script:${option?.script ?? ''}.js`}
          loading={scriptDocument.loading}
          dirty={scriptDocument.dirty}
          onChange={scriptDocument.setValue}
          onSave={handleSaveScriptDocument}
          onClose={() => setScriptOpen(false)}
        />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('profiles.modals.confirmDelete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="break-words select-text">
              {t('profiles.modals.confirmDelete.message')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              {t('shared.actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onDelete()
                setConfirmOpen(false)
              }}
            >
              {t('shared.actions.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {qrOpen && itemData.url && (
        <QrViewer
          open={true}
          value={`${itemData.url}${itemData.url.includes('?') ? '&' : '?'}name=${encodeURIComponent(name!)}`}
          onClose={() => setQrOpen(false)}
        />
      )}
    </>
  )
}

interface MenuEntryProps {
  item: { handler: () => void; disabled: boolean }
  label: string
  isDelete: boolean
  Item: typeof DropdownMenuItem | typeof ContextMenuItem
  Separator: typeof DropdownMenuSeparator | typeof ContextMenuSeparator
}

const MenuEntry = ({
  item,
  label,
  isDelete,
  Item,
  Separator,
}: MenuEntryProps) => (
  <>
    {isDelete && <Separator />}
    <Item
      disabled={item.disabled}
      variant={isDelete ? 'destructive' : 'default'}
      onSelect={() => item.handler()}
    >
      {label}
    </Item>
  </>
)

export const ProfileItem = memo(ProfileItemBase)

function parseUrl(url?: string) {
  if (!url) return ''
  return isValidUrl(url) ? new URL(url).host : 'local file'
}

function parseExpire(expire?: number) {
  if (!expire) return '-'
  return dayjs(expire * 1000).format('YYYY-MM-DD')
}
