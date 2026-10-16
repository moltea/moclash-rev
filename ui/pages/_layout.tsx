import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useNavigate } from 'react-router'

import { useI18n } from '@/hooks/use-i18n'
import { useVerge } from '@/hooks/use-verge'
import { useWindowDecorations } from '@/hooks/use-window'
import { useLoadingOverlay } from '@/pages/_layout/hooks/use-loading-overlay'
import { usePendingFailures } from '@/pages/_layout/hooks/use-pending-failures'
import { useEventBus } from '@/services/bus'
import { handleNoticeMessage } from '@/services/notice-handlers'
import getSystem from '@/utils/get-system'
import { BaseErrorBoundary } from '@ui/components/base'
import { LayoutSidebar } from '@ui/components/layout/layout-sidebar'
import { NoticeManager } from '@ui/components/layout/notice-manager'
import { ServiceMigrationDialog } from '@ui/components/layout/service-migration-dialog'
import { SysproxyPrivilegeDialog } from '@ui/components/layout/sysproxy-privilege-dialog'
import {
  WindowControls,
  WindowResizeHandles,
} from '@ui/components/layout/window-controller'
import { SidebarInset, SidebarProvider } from '@ui/components/ui/sidebar'
import { TooltipProvider } from '@ui/components/ui/tooltip'
import { useCustomTheme } from '@ui/hooks/use-custom-theme'
import { cn } from '@ui/lib/utils'

import 'dayjs/locale/ru'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)

const OS = getSystem()

const NARROW_QUERY = '(max-width: 719px)'

const subscribeNarrow = (onChange: () => void) => {
  const query = window.matchMedia(NARROW_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const getNarrow = () => window.matchMedia(NARROW_QUERY).matches

const Layout = () => {
  const { t } = useTranslation()
  const { ready } = useCustomTheme()
  const { verge, patchVerge } = useVerge()
  const { language } = verge ?? {}
  const navCollapsed = verge?.collapse_navbar ?? false
  const { switchLanguage } = useI18n()
  const navigate = useNavigate()
  const { decorated } = useWindowDecorations()
  const isNarrow = useSyncExternalStore(subscribeNarrow, getNarrow)

  useLoadingOverlay(ready)

  const handleNotice = useCallback(
    (payload: [string, string]) => {
      const [status, msg] = payload
      try {
        handleNoticeMessage(status, msg, t, navigate)
      } catch (error) {
        console.error('[Layout] Failed to handle notice:', error)
      }
    },
    [t, navigate],
  )

  useEventBus(handleNotice)
  usePendingFailures()

  useEffect(() => {
    if (language) {
      dayjs.locale(language === 'zh' ? 'zh-cn' : language)
      switchLanguage(language)
    }
  }, [language, switchLanguage])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (isNarrow) return
      void patchVerge({ collapse_navbar: !open })
    },
    [isNarrow, patchVerge],
  )

  if (!ready) {
    return <div className="size-full bg-background" />
  }

  return (
    <TooltipProvider delayDuration={300}>
      <NoticeManager position={verge?.notice_position} />
      <ServiceMigrationDialog />
      <SysproxyPrivilegeDialog />
      <div
        className={cn(
          OS,
          'flex size-full flex-col overflow-hidden bg-background text-foreground',
          OS === 'linux' && 'rounded-lg',
        )}
        onContextMenu={(e) => {
          const target = e.target as HTMLElement
          if (
            OS === 'windows' &&
            !['input', 'textarea'].includes(target.tagName.toLowerCase()) &&
            !target.isContentEditable
          ) {
            e.preventDefault()
          }
        }}
      >
        {decorated === false && <WindowResizeHandles />}
        <SidebarProvider
          open={!navCollapsed && !isNarrow}
          onOpenChange={handleOpenChange}
          className="min-h-0 flex-1"
          style={{ '--sidebar-width': '12rem' } as CSSProperties}
        >
          <LayoutSidebar />
          <SidebarInset className="min-w-0 overflow-hidden">
            {decorated === false && (
              <div
                className={cn(
                  'flex h-9 shrink-0 items-center px-2',
                  OS === 'macos' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                <div className="h-full flex-1" data-tauri-drag-region="true" />
                <WindowControls />
              </div>
            )}
            <BaseErrorBoundary>
              <Outlet />
            </BaseErrorBoundary>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </TooltipProvider>
  )
}

export default Layout
