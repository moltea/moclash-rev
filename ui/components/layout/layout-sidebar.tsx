import { DragDropProvider, KeyboardSensor, PointerSensor } from '@dnd-kit/react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import IconDark from '@/assets/image/icon_dark.svg?react'
import IconLight from '@/assets/image/icon_light.svg?react'
import LogoSvg from '@/assets/image/logo.svg?react'
import { useVerge } from '@/hooks/use-verge'
import { useNavMenuOrder } from '@/pages/_layout/hooks/use-nav-menu-order'
import { useThemeMode } from '@/services/states'
import { SortableItem } from '@ui/components/base'
import { Badge } from '@ui/components/ui/badge'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@ui/components/ui/context-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@ui/components/ui/sidebar'
import { navItems } from '@ui/pages/_navigation'

import { LayoutItem } from './layout-item'
import { LayoutTraffic } from './layout-traffic'
import { UpdateButton } from './update-button'

const SENSORS = [PointerSensor, KeyboardSensor]

export const LayoutSidebar = () => {
  const { t } = useTranslation()
  const isDark = useThemeMode() !== 'light'
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const { verge, mutateVerge, patchVerge } = useVerge()
  const [menuUnlocked, setMenuUnlocked] = useState(false)

  const handleMenuOrderOptimisticUpdate = useCallback(
    (order: string[]) => {
      mutateVerge(
        (prev) => (prev ? { ...prev, menu_order: order } : prev),
        false,
      )
    },
    [mutateVerge],
  )

  const handleMenuOrderPersist = useCallback(
    (order: string[]) => patchVerge({ menu_order: order }),
    [patchVerge],
  )

  const {
    menuOrder,
    navItemMap,
    handleMenuDragEnd,
    isDefaultOrder,
    resetMenuOrder,
  } = useNavMenuOrder({
    enabled: menuUnlocked,
    items: navItems,
    storedOrder: verge?.menu_order,
    onOptimisticUpdate: handleMenuOrderOptimisticUpdate,
    onPersist: handleMenuOrderPersist,
  })

  const handleResetMenuOrder = useCallback(() => {
    void resetMenuOrder()
  }, [resetMenuOrder])

  const handleUnlockMenu = useCallback(() => {
    setMenuUnlocked(true)
  }, [])

  const handleLockMenu = useCallback(() => {
    setMenuUnlocked(false)
  }, [])

  const AppIcon = isDark ? IconDark : IconLight

  const navMenuItems = menuOrder.map((path, index) => {
    const item = navItemMap.get(path)
    if (!item) return null

    const icon = [
      <item.icon key="monochrome" />,
      <item.colorfulIcon key="colorful" />,
    ]

    if (!menuUnlocked) {
      return (
        <LayoutItem key={item.path} to={item.path} icon={icon}>
          {t(item.label)}
        </LayoutItem>
      )
    }

    return (
      <SortableItem key={item.path} id={item.path} index={index}>
        {(sortable) => (
          <LayoutItem to={item.path} icon={icon} sortable={sortable}>
            {t(item.label)}
          </LayoutItem>
        )}
      </SortableItem>
    )
  })

  return (
    <Sidebar collapsible="icon" className="select-none">
      <SidebarHeader
        data-tauri-drag-region="true"
        className="h-14 shrink-0 flex-row items-center gap-1.5 px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
      >
        <AppIcon className="pointer-events-none size-8 shrink-0" />
        <LogoSvg
          fill="currentColor"
          className="pointer-events-none h-5 w-auto min-w-0 text-foreground group-data-[collapsible=icon]:hidden"
        />
        <UpdateButton className="ml-auto group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <SidebarContent>
            {menuUnlocked && (
              <div className="px-2 pt-1 group-data-[collapsible=icon]:hidden">
                <Badge
                  variant="outline"
                  className="w-full border-warning/40 bg-warning/10 text-warning"
                >
                  {t('layout.components.navigation.menu.reorderMode')}
                </Badge>
              </div>
            )}
            <SidebarGroup>
              <SidebarMenu>
                <DragDropProvider
                  sensors={SENSORS}
                  onDragEnd={handleMenuDragEnd}
                >
                  {navMenuItems}
                </DragDropProvider>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={toggleSidebar}>
            {isCollapsed
              ? t('layout.components.navigation.menu.expandNavBar')
              : t('layout.components.navigation.menu.collapseNavBar')}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={menuUnlocked ? handleLockMenu : handleUnlockMenu}
          >
            {menuUnlocked
              ? t('layout.components.navigation.menu.lock')
              : t('layout.components.navigation.menu.unlock')}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={isDefaultOrder}
            onSelect={handleResetMenuOrder}
          >
            {t('layout.components.navigation.menu.restoreDefaultOrder')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <SidebarFooter className="px-4 pb-3 group-data-[collapsible=icon]:hidden">
        <LayoutTraffic />
      </SidebarFooter>
    </Sidebar>
  )
}
