import type { ReactNode } from 'react'
import { useMatch, useNavigate, useResolvedPath } from 'react-router'

import { useVerge } from '@/hooks/use-verge'
import type { SortableItemRenderProps } from '@ui/components/base'
import { SidebarMenuButton, SidebarMenuItem } from '@ui/components/ui/sidebar'
import { cn } from '@ui/lib/utils'

interface Props {
  to: string
  children: string
  icon: ReactNode[]
  sortable?: SortableItemRenderProps
}

export const LayoutItem = (props: Props) => {
  const { to, children, icon, sortable } = props
  const { verge } = useVerge()
  const { menu_icon } = verge ?? {}
  const navCollapsed = verge?.collapse_navbar ?? false
  const resolved = useResolvedPath(to)
  const match = useMatch({ path: resolved.pathname, end: true })
  const navigate = useNavigate()

  const effectiveMenuIcon =
    navCollapsed && menu_icon === 'disable' ? 'monochrome' : menu_icon

  return (
    <SidebarMenuItem
      ref={sortable?.ref}
      style={sortable?.style}
      className={cn(sortable?.isDragging && 'z-10')}
    >
      <SidebarMenuButton
        ref={sortable?.handleRef}
        isActive={!!match}
        tooltip={children}
        aria-label={navCollapsed ? children : undefined}
        className={cn(
          'font-medium',
          effectiveMenuIcon === 'disable' && 'justify-center',
          sortable?.isDragging && 'bg-sidebar-accent shadow-md',
        )}
        onClick={() => navigate(to)}
      >
        {(effectiveMenuIcon === 'monochrome' || !effectiveMenuIcon) && icon[0]}
        {effectiveMenuIcon === 'colorful' && icon[1]}
        <span>{children}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
