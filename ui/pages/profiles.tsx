import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { readText } from '@tauri-apps/plugin-clipboard-manager'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { useLockFn } from 'ahooks'
import { throttle } from 'lodash-es'
import {
  ClipboardPasteIcon,
  FileTextIcon,
  FlameIcon,
  type LucideIcon,
  RefreshCwIcon,
  SquareCheckIcon,
  SquareIcon,
  SquareMinusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react'
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { closeAllConnections } from 'tauri-plugin-mihomo-api'

import { fetchProfilesIntoCache, useProfiles } from '@/hooks/use-profiles'
import {
  createProfile,
  deleteProfile,
  enhanceProfiles,
  getRuntimeLogs,
  importProfile,
  reorderProfile,
  updateProfile,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { errorDetail, showNotice } from '@/services/notice-service'
import { revalidateQuery, useQuery } from '@/services/query-client'
import {
  useProfileLoadingCache,
  useProfileUpdates,
  useSetProfileLoading,
} from '@/store/app-store-context'
import { debugLog } from '@/utils/debug'
import { isValidUrl } from '@/utils/network'
import { BasePage, type DialogRef } from '@ui/components/base'
import { ProfileItem } from '@ui/components/profile/profile-item'
import { ProfileMore } from '@ui/components/profile/profile-more'
import {
  ProfileViewer,
  type ProfileViewerRef,
} from '@ui/components/profile/profile-viewer'
import { ConfigViewer } from '@ui/components/setting/mods/config-viewer'
import { Button } from '@ui/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/ui/input-group'
import { Separator } from '@ui/components/ui/separator'
import { Spinner } from '@ui/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

const HeaderAction = ({
  title,
  icon: Icon,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'title'> & {
  title: string
  icon: LucideIcon
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={title}
        className={className}
        {...props}
      >
        <Icon />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{title}</TooltipContent>
  </Tooltip>
)

const PROFILE_UPDATE_WORKER_LIMIT = 8
const PROFILE_SWITCH_LOADING_DELAY = 400
const profilePointerSensor = PointerSensor.configure({
  activationConstraints: () => undefined,
})

interface ProfileSwitchRequest {
  profile: string
  notifySuccess: boolean
  force: boolean
}

const debugProfileSwitch = (action: string, profile: string, extra?: any) => {
  const timestamp = new Date().toISOString().substring(11, 23)
  debugLog(`[Profile-Debug][${timestamp}] ${action}: ${profile}`, extra || '')
}

const ProfilePage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const [url, setUrl] = useState('')
  const [disabled, setDisabled] = useState(false)
  const [profileDndRevision, setProfileDndRevision] = useState(0)
  const [activatings, setActivatings] = useState<string[]>([])
  const [switchTarget, setSwitchTarget] = useState<string | null>(null)
  const [visibleSwitchingProfile, setVisibleSwitchingProfile] = useState<
    string | null
  >(null)
  const [loading, setLoading] = useState(false)

  const [batchMode, setBatchMode] = useState(false)
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(
    () => new Set(),
  )

  const latestSwitchTargetRef = useRef<string | null>(null)
  const queuedSwitchRef = useRef<ProfileSwitchRequest | null>(null)
  const switchRunnerRef = useRef<Promise<void> | null>(null)
  const switchLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const currentProfileRef = useRef<string | undefined>(undefined)
  const profilePageMountedRef = useRef(true)
  const { current } = location.state || {}

  const {
    profiles = {},
    patchProfiles,
    mutateProfiles,
    error,
    isStale,
  } = useProfiles()

  useEffect(() => {
    currentProfileRef.current = profiles.current!
  }, [profiles])

  useEffect(() => {
    const unlisten = getCurrentWindow().onDragDropEvent(async (event) => {
      if (event.payload.type !== 'drop') return
      const paths = event.payload.paths

      for (const file of paths) {
        if (!file.endsWith('.yaml') && !file.endsWith('.yml')) {
          showNotice.error('profiles.page.feedback.errors.onlyYaml')
          continue
        }
        const item = {
          type: 'local',
          name: file.split(/\/|\\/).pop() ?? 'New Profile',
          desc: '',
          url: '',
          option: {
            with_proxy: false,
            self_proxy: false,
          },
        } as IProfileItem
        const data = await readTextFile(file)
        await mutate(() => createProfile(item, data), {
          id: 'create-profile',
          errorNotice: false,
          revalidate: [['getProfiles']],
        })
      }
      await mutate(() => enhanceProfiles(), {
        id: 'enhance-profiles',
        errorNotice: false,
      })
    })

    return () => {
      void unlisten.then((cleanup) => cleanup())
    }
  }, [])

  const onEmergencyRefresh = useLockFn(async () => {
    debugLog('[紧急刷新] 开始强制刷新所有数据')

    try {
      await Promise.all([revalidateQuery(['getRuntimeLogs']), mutateProfiles()])

      await new Promise((resolve) => setTimeout(resolve, 500))
      await onEnhance(false)

      showNotice.success(
        'profiles.page.feedback.notices.forceRefreshCompleted',
        2000,
      )
    } catch (error) {
      console.error('[紧急刷新] 失败:', error)
      showNotice.error(
        'profiles.page.feedback.notices.emergencyRefreshFailed',
        { message: errorDetail(error) },
        4000,
      )
    }
  })

  const { data: chainLogs = {}, refetch: refetchLogs } = useQuery({
    queryKey: ['getRuntimeLogs'],
    queryFn: getRuntimeLogs,
  })
  const refetchLogsRef = useRef(refetchLogs)
  refetchLogsRef.current = refetchLogs
  const mutateLogs = useCallback(() => refetchLogsRef.current(), [])

  const viewerRef = useRef<ProfileViewerRef>(null)
  const configRef = useRef<DialogRef>(null)

  const profileItems = useMemo(() => {
    const items = profiles.items || []

    const type1 = ['local', 'remote']

    return items.filter((i) => i?.type && type1.includes(i.type))
  }, [profiles])

  const currentActivatings = () => {
    return [...new Set([profiles.current ?? ''])].filter(Boolean)
  }

  const onImport = async () => {
    if (!url) return
    if (!isValidUrl(url)) {
      showNotice.error('profiles.page.feedback.errors.invalidUrl')
      return
    }
    setLoading(true)

    const prevCurrent = profiles.current

    const handleImportSuccess = async (noticeKey: string) => {
      showNotice.success(noticeKey)
      setUrl('')
      await performRobustRefresh(prevCurrent)
    }
    try {
      await mutate(() => importProfile(url), {
        id: 'import-profile',
        errorNotice: false,
      })
      await handleImportSuccess('shared.feedback.notifications.importSuccess')
    } catch (initialErr) {
      console.warn('[订阅导入] 首次导入失败:', initialErr)

      const initialDetail = errorDetail(initialErr)
      if (initialDetail.toLowerCase().includes('legacy tls')) {
        showNotice.error(initialErr)
        return
      }

      showNotice.info('profiles.page.feedback.notifications.importRetry')
      try {
        await mutate(
          () =>
            importProfile(url, {
              with_proxy: false,
              self_proxy: true,
            }),
          {
            id: 'import-profile',
            errorNotice: false,
          },
        )
        await handleImportSuccess(
          'shared.feedback.notifications.importWithClashProxy',
        )
      } catch (retryErr) {
        showNotice.error(
          'profiles.page.feedback.notifications.importFail',
          retryErr,
        )
      }
    } finally {
      setDisabled(false)
      setLoading(false)
    }
  }

  const performRobustRefresh = async (prevCurrent?: string | null) => {
    let retryCount = 0
    const maxRetries = 1
    const baseDelay = 200

    while (retryCount < maxRetries) {
      try {
        debugLog(`[导入刷新] 第${retryCount + 1}次尝试刷新配置数据`)

        const fresh = await fetchProfilesIntoCache()

        await new Promise((resolve) =>
          setTimeout(resolve, baseDelay * (retryCount + 1)),
        )

        if (fresh?.current !== prevCurrent) {
          await onEnhance(false)
        }
        return
      } catch (error) {
        console.error(`[导入刷新] 第${retryCount + 1}次刷新失败:`, error)
        retryCount++
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelay * retryCount),
        )
      }
    }

    console.warn(`[导入刷新] 常规刷新失败，尝试清除缓存重新获取`)
    try {
      const fresh = await fetchProfilesIntoCache()
      if (fresh?.current !== prevCurrent) {
        await onEnhance(false)
      }
      showNotice.error(
        'profiles.page.feedback.notifications.importNeedsRefresh',
        3000,
      )
    } catch (finalError) {
      console.error(`[导入刷新] 最终刷新尝试失败:`, finalError)
      showNotice.error(
        'profiles.page.feedback.notifications.importSuccess',
        5000,
      )
    }
  }

  const onDragEnd = async (event: DragEndEvent) => {
    const { operation, canceled } = event
    const { source, target } = operation
    if (canceled || !target || !isSortable(source)) return

    const { index: newIndex, initialIndex: oldIndex } = source.sortable
    if (
      oldIndex < 0 ||
      newIndex < 0 ||
      oldIndex >= profileItems.length ||
      newIndex >= profileItems.length ||
      oldIndex === newIndex
    ) {
      return
    }

    const activeId = profileItems[oldIndex]?.uid
    const overId = profileItems[newIndex]?.uid
    if (activeId == null || overId == null || activeId === overId) return

    try {
      await mutate(() => reorderProfile(activeId, overId), {
        id: 'reorder-profile',
        errorNotice: false,
      })
      mutateProfiles()
    } catch (error) {
      setProfileDndRevision((revision) => revision + 1)
      showNotice.error(error)
    }
  }

  const executeProfileSwitch = useCallback(
    async ({ profile, notifySuccess, force }: ProfileSwitchRequest) => {
      if (!force && currentProfileRef.current === profile) {
        debugProfileSwitch('ALREADY_CURRENT_IGNORED', profile)
        return
      }

      debugProfileSwitch('SWITCH_START', profile)

      try {
        const outcome = await patchProfiles({ current: profile })
        if (outcome.status === 'busy') {
          debugProfileSwitch('SWITCH_BUSY', profile)
          showNotice.info(
            'profiles.page.feedback.notifications.switchBusy',
            2000,
          )
          return
        }

        if (outcome.status === 'valid') {
          currentProfileRef.current = profile
          void mutateLogs().catch(() => {})
          void mutate(() => closeAllConnections(), {
            id: 'close-all-connections',
            errorNotice: false,
          }).catch(() => {})

          if (
            notifySuccess &&
            latestSwitchTargetRef.current === profile &&
            queuedSwitchRef.current === null
          ) {
            showNotice.success(
              'profiles.page.feedback.notifications.profileSwitched',
              1000,
            )
          }
          debugProfileSwitch('SWITCH_SUCCESS', profile)
        } else {
          debugProfileSwitch('SWITCH_REJECTED', profile, outcome)
        }
      } catch (err: any) {
        console.error(`[Profile] 切换失败:`, err)
        showNotice.error(err, 4000)
      } finally {
        debugProfileSwitch('SWITCH_END', profile)
      }
    },
    [mutateLogs, patchProfiles],
  )

  const runProfileSwitchQueue = useCallback(async () => {
    while (profilePageMountedRef.current && queuedSwitchRef.current) {
      const request = queuedSwitchRef.current
      queuedSwitchRef.current = null
      await executeProfileSwitch(request)
    }
  }, [executeProfileSwitch])

  const activateProfile = useCallback(
    (profile: string, notifySuccess: boolean, force = false) => {
      if (!profilePageMountedRef.current) return Promise.resolve()

      if (
        !force &&
        currentProfileRef.current === profile &&
        switchRunnerRef.current === null
      ) {
        debugProfileSwitch('ALREADY_CURRENT_IGNORED', profile)
        return Promise.resolve()
      }

      if (
        latestSwitchTargetRef.current === profile &&
        switchRunnerRef.current
      ) {
        debugProfileSwitch('DUPLICATE_SWITCH_IGNORED', profile)
        return switchRunnerRef.current
      }

      latestSwitchTargetRef.current = profile
      queuedSwitchRef.current = { profile, notifySuccess, force }
      setSwitchTarget(profile)
      setVisibleSwitchingProfile(null)
      if (switchLoadingTimerRef.current) {
        window.clearTimeout(switchLoadingTimerRef.current)
      }
      switchLoadingTimerRef.current = window.setTimeout(() => {
        if (
          profilePageMountedRef.current &&
          latestSwitchTargetRef.current === profile
        ) {
          setVisibleSwitchingProfile(profile)
        }
      }, PROFILE_SWITCH_LOADING_DELAY)

      if (switchRunnerRef.current) {
        debugProfileSwitch('SWITCH_QUEUED', profile)
        return switchRunnerRef.current
      }

      const runner = runProfileSwitchQueue().finally(() => {
        if (switchRunnerRef.current === runner) {
          switchRunnerRef.current = null
          latestSwitchTargetRef.current = null
          if (switchLoadingTimerRef.current) {
            window.clearTimeout(switchLoadingTimerRef.current)
            switchLoadingTimerRef.current = null
          }
          if (profilePageMountedRef.current) {
            setSwitchTarget(null)
            setVisibleSwitchingProfile(null)
          }
        }
      })
      switchRunnerRef.current = runner
      return runner
    },
    [runProfileSwitchQueue],
  )

  const onSelect = async (profile: string, force: boolean) => {
    await activateProfile(profile, true, force)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (current) {
        await mutateProfiles()
        if (cancelled) return
        await activateProfile(current, false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [current, activateProfile, mutateProfiles])

  const onEnhance = useLockFn(async (notifySuccess: boolean) => {
    if (switchRunnerRef.current) {
      debugLog(
        `[Profile] 有profile正在切换中(${latestSwitchTargetRef.current})，跳过enhance操作`,
      )
      return
    }

    const currentProfiles = currentActivatings()
    setActivatings((prev) => [...new Set([...prev, ...currentProfiles])])

    try {
      const result = await mutate(() => enhanceProfiles(), {
        id: 'enhance-profiles',
        errorNotice: false,
      })
      if (!(result.ok && result.value === true)) return
      mutateLogs()
      if (notifySuccess) {
        showNotice.success(
          'profiles.page.feedback.notifications.profileReactivated',
          1000,
        )
      }
    } catch (err: any) {
      showNotice.error(err, 3000)
    } finally {
      setActivatings([])
    }
  })

  const onDelete = useLockFn(async (uid: string) => {
    const current = profiles.current === uid
    try {
      setActivatings([...(current ? currentActivatings() : []), uid])
      await mutate(() => deleteProfile(uid), {
        id: 'delete-profile',
        errorNotice: false,
      })
      mutateProfiles()
      mutateLogs()
      if (current) {
        await onEnhance(false)
      }
    } catch (err: any) {
      showNotice.error(err)
    } finally {
      setActivatings([])
    }
  })

  const loadingCache = useProfileLoadingCache()
  const { updateRevisions: completedUpdateRevisions, timerRevisions } =
    useProfileUpdates()
  const setLoadingProfiles = useSetProfileLoading()

  const runProfileUpdates = useCallback(
    async (uids: string[]) => {
      if (uids.length === 0) return

      const throttleMutate = throttle(mutateProfiles, 2000, {
        trailing: true,
      })
      let cursor = 0

      const updateOne = async (uid: string) => {
        try {
          await mutate(() => updateProfile(uid), {
            id: `update-profile:${uid}`,
            errorNotice: false,
          })
          throttleMutate()
        } catch (err: any) {
          console.error(`更新订阅 ${uid} 失败:`, err)
        }
      }

      const worker = async () => {
        while (cursor < uids.length) {
          const uid = uids[cursor++]
          await updateOne(uid)
        }
      }

      try {
        const active = Math.min(PROFILE_UPDATE_WORKER_LIMIT, uids.length)
        await Promise.allSettled(Array.from({ length: active }, worker))
      } finally {
        setLoadingProfiles(uids, false)
        void mutateProfiles()
      }
    },
    [mutateProfiles, setLoadingProfiles],
  )
  const onUpdateAll = useLockFn(async () => {
    const items = profileItems.filter((e) => e.type === 'remote')
    const target = items
      .map((item) => item.uid!)
      .filter((uid) => !loadingCache.has(uid))

    setLoadingProfiles(target, true)
    await runProfileUpdates(target)
  })

  const onCopyLink = async () => {
    const text = await readText()
    if (text) setUrl(text)
  }

  const toggleBatchMode = () => {
    setBatchMode(!batchMode)
    if (!batchMode) {
      setSelectedProfiles(new Set())
    }
  }

  const toggleProfileSelection = (uid: string) => {
    setSelectedProfiles((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(uid)) {
        newSet.delete(uid)
      } else {
        newSet.add(uid)
      }
      return newSet
    })
  }

  const selectAllProfiles = () => {
    setSelectedProfiles(new Set(profileItems.map((item) => item.uid!)))
  }

  const clearAllSelections = () => {
    setSelectedProfiles(new Set())
  }

  const isAllSelected = () => {
    return (
      profileItems.length > 0 && profileItems.length === selectedProfiles.size
    )
  }

  const getSelectionState = () => {
    if (selectedProfiles.size === 0) {
      return 'none'
    } else if (selectedProfiles.size === profileItems.length) {
      return 'all'
    } else {
      return 'partial'
    }
  }

  const deleteSelectedProfiles = useLockFn(async () => {
    if (selectedProfiles.size === 0) return

    try {
      const currentActivating =
        profiles.current && selectedProfiles.has(profiles.current)
          ? [profiles.current]
          : []

      setActivatings((prev) => [...new Set([...prev, ...currentActivating])])

      for (const uid of selectedProfiles) {
        await mutate(() => deleteProfile(uid), {
          id: 'delete-profile',
          errorNotice: false,
        })
      }

      await mutateProfiles()
      await mutateLogs()

      if (currentActivating.length > 0) {
        await onEnhance(false)
      }

      setSelectedProfiles(new Set())
      setBatchMode(false)

      showNotice.success('profiles.page.feedback.notifications.batchDeleted')
    } catch (err: any) {
      showNotice.error(err)
    } finally {
      setActivatings([])
    }
  })

  useEffect(() => {
    profilePageMountedRef.current = true
    return () => {
      profilePageMountedRef.current = false
      queuedSwitchRef.current = null
      latestSwitchTargetRef.current = null
      if (switchLoadingTimerRef.current) {
        window.clearTimeout(switchLoadingTimerRef.current)
        switchLoadingTimerRef.current = null
      }
    }
  }, [])

  const selectionState = getSelectionState()
  const SelectionIcon =
    selectionState === 'all'
      ? SquareCheckIcon
      : selectionState === 'partial'
        ? SquareMinusIcon
        : SquareIcon

  return (
    <BasePage
      full
      title={t('profiles.page.title')}
      header={
        !batchMode ? (
          <>
            <HeaderAction
              title={t('profiles.page.batch.title')}
              icon={SquareIcon}
              onClick={toggleBatchMode}
            />
            <HeaderAction
              title={t('profiles.page.actions.updateAll')}
              icon={RefreshCwIcon}
              onClick={onUpdateAll}
            />
            <HeaderAction
              title={t('profiles.page.actions.viewRuntimeConfig')}
              icon={FileTextIcon}
              onClick={() => configRef.current?.open()}
            />
            <HeaderAction
              title={t('profiles.page.actions.reactivate')}
              icon={FlameIcon}
              className="text-primary"
              onClick={() => onEnhance(true)}
            />
            {(error || isStale) && (
              <HeaderAction
                title={t(
                  'profiles.page.feedback.tooltips.forceRefreshStaleData',
                )}
                icon={TriangleAlertIcon}
                className="animate-pulse text-warning"
                onClick={onEmergencyRefresh}
              />
            )}
          </>
        ) : (
          <>
            <span className="truncate px-1 text-muted-foreground">
              {t('profiles.page.batch.summary.selected')}{' '}
              {selectedProfiles.size} {t('profiles.page.batch.summary.items')}
            </span>
            <HeaderAction
              title={
                isAllSelected()
                  ? t('profiles.page.batch.actions.deselectAll')
                  : t('profiles.page.batch.actions.selectAll')
              }
              icon={SelectionIcon}
              className={cn(selectionState !== 'none' && 'text-primary')}
              onClick={isAllSelected() ? clearAllSelections : selectAllProfiles}
            />
            <HeaderAction
              title={t('profiles.page.batch.actions.delete')}
              icon={Trash2Icon}
              className="text-destructive"
              disabled={selectedProfiles.size === 0}
              onClick={deleteSelectedProfiles}
            />
            <Button size="sm" variant="outline" onClick={toggleBatchMode}>
              {t('profiles.page.batch.actions.done')}
            </Button>
          </>
        )
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2">
          <InputGroup className="flex-1">
            <InputGroupInput
              value={url}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t('profiles.page.importForm.placeholder')}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
                  return
                }
                if (!url || disabled || loading) {
                  return
                }
                event.preventDefault()
                void onImport()
              }}
            />
            <InputGroupAddon align="inline-end">
              {!url ? (
                <InputGroupButton
                  size="icon-xs"
                  title={t('profiles.page.importForm.actions.paste')}
                  aria-label={t('profiles.page.importForm.actions.paste')}
                  onClick={onCopyLink}
                >
                  <ClipboardPasteIcon />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  size="icon-xs"
                  title={t('shared.actions.clear')}
                  aria-label={t('shared.actions.clear')}
                  onClick={() => setUrl('')}
                >
                  <XIcon />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
          <Button disabled={!url || disabled || loading} onClick={onImport}>
            {loading && <Spinner data-icon="inline-start" />}
            {t('profiles.page.actions.import')}
          </Button>
          <Button variant="outline" onClick={() => viewerRef.current?.create()}>
            {t('shared.actions.new')}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4">
          <DragDropProvider
            key={profileDndRevision}
            sensors={[profilePointerSensor, KeyboardSensor]}
            onDragEnd={onDragEnd}
          >
            <div className="grid grid-cols-[repeat(auto-fill,minmax(clamp(260px,calc((100%_-_24px)/4),480px),1fr))] gap-2">
              {profileItems.map((item, index) => (
                <ProfileItem
                  key={item.uid}
                  id={item.uid!}
                  index={index}
                  selected={(switchTarget ?? profiles.current) === item.uid}
                  activating={
                    activatings.includes(item.uid!) ||
                    visibleSwitchingProfile === item.uid
                  }
                  itemData={item}
                  timerUpdateRevision={timerRevisions.get(item.uid!) ?? 0}
                  completedUpdateRevision={
                    completedUpdateRevisions.get(item.uid!) ?? 0
                  }
                  mutateProfiles={mutateProfiles}
                  onSelect={(f) => onSelect(item.uid!, f)}
                  onEdit={() => viewerRef.current?.edit(item)}
                  onSave={async (prev, curr) => {
                    if (prev !== curr && profiles.current === item.uid) {
                      await onEnhance(false)
                    }
                  }}
                  onDelete={() => {
                    if (batchMode) {
                      toggleProfileSelection(item.uid!)
                    } else {
                      onDelete(item.uid!)
                    }
                  }}
                  batchMode={batchMode}
                  isSelected={selectedProfiles.has(item.uid!)}
                  onSelectionChange={() => toggleProfileSelection(item.uid!)}
                />
              ))}
            </div>
          </DragDropProvider>

          <Separator className="my-3" />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ProfileMore
              id="Merge"
              onSave={async (prev, curr) => {
                if (prev !== curr) {
                  await onEnhance(false)
                }
              }}
            />
            <ProfileMore
              id="Script"
              logInfo={chainLogs['Script']}
              onSave={async (prev, curr) => {
                if (prev !== curr) {
                  await onEnhance(false)
                }
              }}
            />
          </div>
        </div>
      </div>

      <ProfileViewer
        ref={viewerRef}
        onChange={async (isActivating) => {
          mutateProfiles()
          if (isActivating) {
            await onEnhance(false)
          }
        }}
      />
      <ConfigViewer ref={configRef} />
    </BasePage>
  )
}

export default ProfilePage
