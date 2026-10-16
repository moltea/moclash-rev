import {
  CircleCheckIcon,
  InfoIcon,
  type LucideIcon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from 'lucide-react'
import {
  type FC,
  isValidElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast, type ToasterProps } from 'sonner'

import {
  boundNoticeText,
  getSnapshotNotices,
  hideNotice,
  showNotice,
  subscribeNotices,
} from '@/services/notice-service'
import type { TranslationKey } from '@/types/generated/i18n-keys'
import { openExternalUrl } from '@/utils/open-external-url'
import { Button } from '@ui/components/ui/button'
import { Toaster } from '@ui/components/ui/sonner'
import { cn } from '@ui/lib/utils'

const SERVICE_PERMISSION_NOTICE =
  'settings.feedback.notifications.clashService.permissionFallback'
const SERVICE_PERMISSION_GUIDE =
  'https://clash-verge-rev.github.io/faq/windows.html#service-core-permissions'
const SERVICE_OWNER_NOTICE =
  'settings.feedback.notifications.clashService.appDataNotOwned'

type NoticePosition = NonNullable<IVergeConfig['notice_position']>
type NoticeItem = ReturnType<typeof getSnapshotNotices>[number]
type TranslationFn = ReturnType<typeof useTranslation>['t']

const VALID_POSITIONS: NoticePosition[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

const resolvePosition = (position?: NoticePosition | null): NoticePosition => {
  if (position && VALID_POSITIONS.includes(position)) {
    return position
  }
  return 'top-right'
}

const NOTICE_ICONS: Record<
  NoticeItem['type'],
  { icon: LucideIcon; className: string }
> = {
  success: { icon: CircleCheckIcon, className: 'text-success' },
  info: { icon: InfoIcon, className: 'text-info' },
  warning: { icon: TriangleAlertIcon, className: 'text-warning' },
  error: { icon: OctagonXIcon, className: 'text-destructive' },
}

const toToastId = (id: number) => `notice-${id}`

const GuideLink = ({ t }: { t: TranslationFn }) => (
  <a
    href={SERVICE_PERMISSION_GUIDE}
    className="underline"
    onClick={(event) => {
      event.preventDefault()
      void openExternalUrl(SERVICE_PERMISSION_GUIDE).catch(showNotice.error)
    }}
  >
    {t('settings.feedback.notifications.clashService.permissionRepairGuide')}
  </a>
)

const resolveNoticeMessage = (
  notice: NoticeItem,
  t: TranslationFn,
  options?: { bounded?: boolean },
): ReactNode => {
  const bound = (text: ReactNode): ReactNode =>
    options?.bounded === false || typeof text !== 'string'
      ? text
      : boundNoticeText(text)

  const i18n = notice.i18n
  if (!i18n) return bound(notice.message)

  const detail = i18n.params?.message
  const existingCore =
    typeof detail === 'string'
      ? /process verge-mihomo(?:-alpha|-al)?(?:\.exe)? (?:\(PID (\d+)\) is still running|remains after IPC failure); refusing a second core\s*$/.exec(
          detail,
        )
      : null
  if (existingCore && typeof detail === 'string') {
    const permissionRejected = detail.startsWith('Service core rejected:')
    return (
      <>
        {permissionRejected && (
          <div className="mb-2">
            {t(
              'settings.feedback.notifications.clashService.permissionRejectedReason',
            )}{' '}
            <GuideLink t={t} />
          </div>
        )}
        {t('settings.feedback.errors.clashService.coreAlreadyRunning')}
        {existingCore[1] && <div className="mt-2">PID {existingCore[1]}</div>}
        <details className="mt-2">
          <summary className="cursor-pointer">
            {t('shared.feedback.errors.details')}
          </summary>
          <pre className="m-0 mt-2 max-h-40 overflow-auto text-[length:inherit] wrap-anywhere whitespace-pre-wrap select-text">
            {detail}
          </pre>
        </details>
      </>
    )
  }

  if (i18n.key === SERVICE_PERMISSION_NOTICE) {
    return (
      <>
        {t(SERVICE_PERMISSION_NOTICE, {
          reason: t(
            'settings.feedback.notifications.clashService.permissionRejectedReason',
          ),
        })}
        <div className="mt-2">
          <GuideLink t={t} />
        </div>
      </>
    )
  }

  if (i18n.key === SERVICE_OWNER_NOTICE) {
    return (
      <>
        {t(SERVICE_OWNER_NOTICE)}
        <code className="mt-2 block break-all whitespace-pre-wrap select-text">
          {String(i18n.params?.command ?? '')}
        </code>
      </>
    )
  }

  const source = (i18n.params ?? {}) as Record<string, unknown>
  const params =
    options?.bounded === false
      ? source
      : Object.fromEntries(
          Object.entries(source).map(([key, value]) => [
            key,
            typeof value === 'string' ? boundNoticeText(value) : value,
          ]),
        )
  const { prefixKey, prefixParams, prefix, message, ...restParams } = params

  const prefixKeyParams =
    prefixParams && typeof prefixParams === 'object'
      ? (prefixParams as Record<string, unknown>)
      : undefined

  const resolvedPrefix =
    typeof prefixKey === 'string'
      ? t(prefixKey as TranslationKey, {
          defaultValue: prefixKey,
          ...(prefixKeyParams ?? {}),
          ...restParams,
        })
      : typeof prefix === 'string'
        ? prefix
        : undefined

  const messageStr = typeof message === 'string' ? message : undefined

  const defaultValue =
    messageStr === undefined
      ? undefined
      : resolvedPrefix
        ? `${resolvedPrefix} ${messageStr}`
        : messageStr

  return bound(
    t(i18n.key as TranslationKey, {
      defaultValue,
      ...restParams,
      ...(resolvedPrefix !== undefined ? { prefix: resolvedPrefix } : {}),
      ...(messageStr !== undefined ? { message: messageStr } : {}),
    }),
  )
}

const extractNoticeCopyText = (input: unknown): string | undefined => {
  if (input === null || input === undefined) return undefined
  if (typeof input === 'string') return input
  if (typeof input === 'number' || typeof input === 'boolean') {
    return String(input)
  }
  if (input instanceof Error) {
    return input.message || input.name
  }
  if (isValidElement(input)) return undefined
  if (typeof input === 'object') {
    const maybeMessage = (input as { message?: unknown }).message
    if (typeof maybeMessage === 'string') return maybeMessage
  }
  try {
    return JSON.stringify(input)
  } catch {
    return String(input)
  }
}

const resolveNoticeCopyText = (
  notice: NoticeItem,
  t: TranslationFn,
): string | undefined => {
  if (notice.i18n?.key === SERVICE_PERMISSION_NOTICE) {
    return extractNoticeCopyText(notice.i18n.params?.reason)
  }
  if (notice.i18n?.key === SERVICE_OWNER_NOTICE) {
    return extractNoticeCopyText(notice.i18n.params?.command)
  }
  if (
    notice.i18n?.key === 'shared.feedback.notices.prefixedRaw' ||
    notice.i18n?.key === 'shared.feedback.notices.raw'
  ) {
    const rawText = extractNoticeCopyText(notice.i18n?.params?.message)
    if (rawText) return rawText
  }

  return (
    extractNoticeCopyText(
      resolveNoticeMessage(notice, t, { bounded: false }),
    ) ?? extractNoticeCopyText(notice.message)
  )
}

const NoticeToast = ({ notice }: { notice: NoticeItem }) => {
  const { t } = useTranslation()
  const { icon: Icon, className } = NOTICE_ICONS[notice.type]

  const handleNoticeCopy = useCallback(async () => {
    const text = resolveNoticeCopyText(notice, t)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      showNotice.success(
        'shared.feedback.notifications.common.copySuccess',
        1000,
      )
    } catch (error) {
      console.warn('[NoticeManager] copy to clipboard failed:', error)
    }
  }, [notice, t])

  return (
    <div
      role="alert"
      className="flex w-(--width) items-start gap-2 rounded-lg border bg-popover p-3 text-xs/relaxed text-popover-foreground shadow-lg"
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void handleNoticeCopy()
      }}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', className)} />
      <div className="min-w-0 flex-1 wrap-break-word">
        {resolveNoticeMessage(notice, t)}
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        onClick={() => hideNotice(notice.id)}
      >
        <XIcon />
      </Button>
    </div>
  )
}

interface NoticeManagerProps {
  position?: NoticePosition | null
}

export const NoticeManager: FC<NoticeManagerProps> = ({ position }) => {
  const resolvedPosition = useMemo(
    () => resolvePosition(position) as ToasterProps['position'],
    [position],
  )
  const currentNotices = useSyncExternalStore(
    subscribeNotices,
    getSnapshotNotices,
  )
  const shownRef = useRef(new Set<number>())

  useEffect(() => {
    const shown = shownRef.current
    const activeIds = new Set(currentNotices.map(({ id }) => id))

    for (const id of shown) {
      if (!activeIds.has(id)) {
        shown.delete(id)
        toast.dismiss(toToastId(id))
      }
    }

    for (const notice of currentNotices) {
      if (shown.has(notice.id)) continue
      shown.add(notice.id)
      toast.custom(() => <NoticeToast notice={notice} />, {
        id: toToastId(notice.id),
        duration: Number.POSITIVE_INFINITY,
        dismissible: false,
      })
    }
  }, [currentNotices])

  return (
    <Toaster
      position={resolvedPosition}
      expand
      visibleToasts={Number.POSITIVE_INFINITY}
      gap={10}
      offset={20}
    />
  )
}
