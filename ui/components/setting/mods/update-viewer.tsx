import { useLockFn } from 'ahooks'
import { ExternalLinkIcon } from 'lucide-react'
import type { Ref } from 'react'
import {
  lazy,
  Suspense,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { Options as ReactMarkdownOptions } from 'react-markdown'

import { useUpdate } from '@/hooks/use-update'
import type { DownloadEvent } from '@/services/bindings'
import {
  cancelUpdateDownload,
  installUpdate,
  restartApp,
} from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { useSetUpdateState, useUpdateState } from '@/services/states'
import { openExternalUrl } from '@/utils/open-external-url'
import { BaseDialog, type DialogRef } from '@ui/components/base'
import { Button } from '@ui/components/ui/button'
import { Progress } from '@ui/components/ui/progress'
import { Skeleton } from '@ui/components/ui/skeleton'
import { cn } from '@ui/lib/utils'

type MarkdownNode = {
  type: string
  value?: string
  children?: MarkdownNode[]
  data?: {
    hProperties?: Record<string, unknown>
  }
}

const GITHUB_ALERTS = {
  note: {
    labelKey: 'settings.modals.update.alerts.note',
    className: 'border-info bg-info/10',
  },
  tip: {
    labelKey: 'settings.modals.update.alerts.tip',
    className: 'border-success bg-success/10',
  },
  important: {
    labelKey: 'settings.modals.update.alerts.important',
    className: 'border-primary bg-primary/10',
  },
  warning: {
    labelKey: 'settings.modals.update.alerts.warning',
    className: 'border-warning bg-warning/10',
  },
  caution: {
    labelKey: 'settings.modals.update.alerts.caution',
    className: 'border-destructive bg-destructive/10',
  },
} as const

type GitHubAlertType = keyof typeof GITHUB_ALERTS

const GITHUB_ALERT_PATTERN =
  /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*\n?/i
const GITHUB_ALERT_CLASS_PATTERN =
  /markdown-alert-(note|tip|important|warning|caution)/
const UPDATE_MARKDOWN_ID_PREFIX = 'update-markdown-'

const MARKDOWN_CLASS = cn(
  'min-h-0 flex-1 overflow-auto pe-3 text-sm/relaxed wrap-break-word text-foreground',
  '[&>:first-child]:mt-0 [&>:last-child]:mb-0',
  '[&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-2xl/tight [&_h1]:font-semibold',
  '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg/snug [&_h2]:font-semibold',
  '[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base/snug [&_h3]:font-semibold',
  '[&_h4]:mt-3 [&_h4]:mb-1.5 [&_h4]:font-semibold [&_h5]:mt-3 [&_h5]:mb-1.5 [&_h5]:font-semibold [&_h6]:mt-3 [&_h6]:mb-1.5 [&_h6]:font-semibold',
  '[&_p]:my-2',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:ps-6 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:ps-6',
  '[&_li]:my-1 [&_li]:ps-0.5',
  '[&_a]:text-primary [&_a]:underline-offset-4 [&_a]:wrap-anywhere [&_a:hover]:underline',
  '[&_strong]:font-bold',
  '[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.92em]',
  '[&_pre]:my-3 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[0.9em]',
  '[&_table]:my-3 [&_table]:block [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-x-auto',
  '[&_td]:border [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1.5 [&_th]:align-top [&_th]:font-bold',
  '[&_hr]:my-4 [&_hr]:border-0 [&_hr]:border-t',
  '[&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md',
  '[&_blockquote:not(.markdown-alert)]:mt-3 [&_blockquote:not(.markdown-alert)]:mb-4 [&_blockquote:not(.markdown-alert)]:border-s-4 [&_blockquote:not(.markdown-alert)]:ps-4 [&_blockquote:not(.markdown-alert)]:text-muted-foreground',
)

const shouldShowReleaseNotes = (language: string) => language === 'zh'

const LazyReactMarkdown = lazy(async () => {
  const [
    { default: ReactMarkdown },
    { default: rehypeRaw },
    { default: rehypeSanitize, defaultSchema },
    { default: remarkGfm },
  ] = await Promise.all([
    import('react-markdown'),
    import('rehype-raw'),
    import('rehype-sanitize'),
    import('remark-gfm'),
  ])

  const sanitizeSchema = {
    ...defaultSchema,
    clobberPrefix: UPDATE_MARKDOWN_ID_PREFIX,
    attributes: {
      ...defaultSchema.attributes,
      blockquote: [
        ...(defaultSchema.attributes?.blockquote ?? []),
        [
          'className',
          'markdown-alert',
          ...Object.keys(GITHUB_ALERTS).map((type) => `markdown-alert-${type}`),
        ],
      ],
      p: [
        ...(defaultSchema.attributes?.p ?? []),
        ['className', 'markdown-alert-title'],
      ],
    },
  }

  return {
    default: (props: ReactMarkdownOptions) => (
      <ReactMarkdown
        {...props}
        remarkPlugins={[remarkGfm, ...(props.remarkPlugins ?? [])]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      />
    ),
  }
})

const getAlertTypeFromClassName = (
  className: unknown,
): GitHubAlertType | null => {
  const value = Array.isArray(className)
    ? className.join(' ')
    : typeof className === 'string'
      ? className
      : ''
  const match = value.match(GITHUB_ALERT_CLASS_PATTERN)
  return match?.[1] as GitHubAlertType | null
}

const findFirstTextNode = (node: MarkdownNode): MarkdownNode | null => {
  if (node.type === 'text') return node
  for (const child of node.children ?? []) {
    const result = findFirstTextNode(child)
    if (result) return result
  }
  return null
}

const remarkGitHubAlerts = (labels: Record<GitHubAlertType, string>) => {
  const visit = (node: MarkdownNode) => {
    for (const child of node.children ?? []) {
      visit(child)
    }

    if (node.type !== 'blockquote') return

    const firstTextNode = findFirstTextNode(node)
    const match = firstTextNode?.value?.match(GITHUB_ALERT_PATTERN)
    if (!firstTextNode?.value || !match) return

    const alertType = match[1].toLowerCase() as GitHubAlertType
    firstTextNode.value = firstTextNode.value
      .replace(GITHUB_ALERT_PATTERN, '')
      .replace(/^\n+/, '')

    node.data = {
      ...(node.data ?? {}),
      hProperties: {
        ...(node.data?.hProperties ?? {}),
        className: ['markdown-alert', `markdown-alert-${alertType}`],
      },
    }

    node.children?.unshift({
      type: 'paragraph',
      data: {
        hProperties: {
          className: 'markdown-alert-title',
        },
      },
      children: [
        {
          type: 'text',
          value: labels[alertType],
        },
      ],
    })
  }

  return visit
}

export function UpdateViewer({ ref }: { ref?: Ref<DialogRef> }) {
  const { t, i18n } = useTranslation()

  const [open, setOpen] = useState(false)
  const updateState = useUpdateState()
  const setUpdateState = useSetUpdateState()

  const { updateInfo } = useUpdate()

  const [downloaded, setDownloaded] = useState(0)
  const [total, setTotal] = useState(0)
  const downloadedRef = useRef(0)
  const totalRef = useRef(0)

  const openUrlWithNotice = (url: string) => {
    void openExternalUrl(url).catch(showNotice.error)
  }

  const progress = useMemo(() => {
    if (total <= 0) return 0
    return Math.min((downloaded / total) * 100, 100)
  }, [downloaded, total])

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }))

  const githubAlertLabels = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(GITHUB_ALERTS).map(([type, alert]) => [
          type,
          t(alert.labelKey),
        ]),
      ) as Record<GitHubAlertType, string>,
    [t],
  )
  const remarkGitHubAlertsPlugin = useMemo(
    () => () => remarkGitHubAlerts(githubAlertLabels),
    [githubAlertLabels],
  )

  const activeLanguage = i18n.resolvedLanguage ?? i18n.language
  const markdownContent = useMemo(() => {
    if (!updateInfo?.body) {
      return t('settings.modals.update.messages.available')
    }
    if (!shouldShowReleaseNotes(activeLanguage)) {
      return t('settings.modals.update.messages.available')
    }
    return updateInfo?.body
  }, [activeLanguage, t, updateInfo])

  const breakChangeFlag = useMemo(() => {
    if (!updateInfo?.body) {
      return false
    }
    return updateInfo?.body.toLowerCase().includes('break change')
  }, [updateInfo])

  const onUpdate = useLockFn(async () => {
    if (!updateInfo?.body) return
    if (breakChangeFlag) {
      showNotice.error('settings.modals.update.messages.breakChangeError')
      return
    }
    if (updateState) return
    setUpdateState(true)
    setDownloaded(0)
    setTotal(0)
    downloadedRef.current = 0
    totalRef.current = 0

    const onDownloadEvent = (event: DownloadEvent) => {
      if (event.event === 'Started') {
        const contentLength = event.data.contentLength ?? 0
        totalRef.current = contentLength
        setTotal(contentLength)
        setDownloaded(0)
        downloadedRef.current = 0
        return
      }

      if (event.event === 'Progress') {
        setDownloaded((prev) => {
          const next = prev + event.data.chunkLength
          downloadedRef.current = next
          return next
        })
      }

      if (event.event === 'Finished' && totalRef.current === 0) {
        totalRef.current = downloadedRef.current
        setTotal(downloadedRef.current)
      }
    }

    try {
      const result = await mutate(
        () => installUpdate(updateInfo.version, onDownloadEvent),
        {
          id: 'install-app-update',
          errorNotice: false,
        },
      )
      if (result.ok && result.value) {
        await mutate(() => restartApp(), {
          id: 'restart-app',
          errorNotice: false,
        })
      }
    } catch (err: any) {
      showNotice.error(err)
    } finally {
      setUpdateState(false)
      setDownloaded(0)
      setTotal(0)
      downloadedRef.current = 0
      totalRef.current = 0
    }
  })

  return (
    <BaseDialog
      open={open}
      title={t('settings.modals.update.title', {
        version: updateInfo?.version ?? '',
      })}
      className="sm:max-w-xl"
      contentClassName="flex flex-[0_1_min(64vh,680px)] flex-col gap-3"
      okBtn={t('settings.modals.update.actions.update')}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => setOpen(false)}
      onCancel={() => {
        if (updateState) {
          void mutate(() => cancelUpdateDownload(), {
            id: 'cancel-update-download',
            errorNotice: false,
          }).catch(showNotice.error)
        }
        setOpen(false)
      }}
      onOk={onUpdate}
    >
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            openUrlWithNotice(
              `https://github.com/moltea/moclash-rev/releases/tag/v${updateInfo?.version}`,
            )
          }}
        >
          <ExternalLinkIcon data-icon="inline-start" />
          {t('settings.modals.update.actions.goToRelease')}
        </Button>
      </div>
      <div className={MARKDOWN_CLASS}>
        {open && (
          <Suspense
            fallback={
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            }
          >
            <LazyReactMarkdown
              remarkPlugins={[remarkGitHubAlertsPlugin]}
              components={{
                a: ({ href, children, ...props }) => {
                  const isFragment = href?.startsWith('#') ?? false
                  const renderedHref = isFragment
                    ? `#${UPDATE_MARKDOWN_ID_PREFIX}${href?.slice(1)}`
                    : href
                      ? '#'
                      : undefined

                  return (
                    <a
                      {...props}
                      href={renderedHref}
                      target={undefined}
                      rel={undefined}
                      onClick={(event) => {
                        if (isFragment) return
                        event.preventDefault()
                        if (!href) return
                        openUrlWithNotice(href)
                      }}
                      onAuxClick={(event) => {
                        if (isFragment) return
                        event.preventDefault()
                        if (event.button === 1 && href) {
                          openUrlWithNotice(href)
                        }
                      }}
                    >
                      {children}
                    </a>
                  )
                },
                blockquote: ({ className, children }) => {
                  const alertType = getAlertTypeFromClassName(className)

                  if (!alertType) {
                    return (
                      <blockquote className={className}>{children}</blockquote>
                    )
                  }

                  return (
                    <blockquote
                      className={cn(
                        className,
                        'mt-3 mb-4 rounded-md border-s-4 px-4 py-2 [&_.markdown-alert-title]:flex [&_.markdown-alert-title]:items-center [&_.markdown-alert-title]:gap-1.5 [&_.markdown-alert-title]:leading-snug [&_.markdown-alert-title]:font-bold [&_p]:my-1.5',
                        GITHUB_ALERTS[alertType].className,
                      )}
                    >
                      {children}
                    </blockquote>
                  )
                },
              }}
            >
              {markdownContent}
            </LazyReactMarkdown>
          </Suspense>
        )}
      </div>
      {updateState && (
        <Progress
          value={total > 0 ? progress : 100}
          className={cn(total <= 0 && 'animate-pulse')}
        />
      )}
    </BaseDialog>
  )
}
