import {
  ArrowRightLeftIcon,
  EarthIcon,
  HouseIcon,
  LockOpenIcon,
  type LucideIcon,
  ScrollTextIcon,
  ServerIcon,
  SettingsIcon,
  WifiIcon,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

import ConnectionsSvg from '@/assets/image/itemicon/connections.svg?react'
import HomeSvg from '@/assets/image/itemicon/home.svg?react'
import LogsSvg from '@/assets/image/itemicon/logs.svg?react'
import ProfilesSvg from '@/assets/image/itemicon/profiles.svg?react'
import ProxiesSvg from '@/assets/image/itemicon/proxies.svg?react'
import RulesSvg from '@/assets/image/itemicon/rules.svg?react'
import SettingsSvg from '@/assets/image/itemicon/settings.svg?react'
import UnlockSvg from '@/assets/image/itemicon/unlock.svg?react'
import { navigationItems } from '@/pages/_navigation-meta'

import ConnectionsPage from './connections'
import HomePage from './home'
import LogsPage from './logs'
import ProfilePage from './profiles'
import ProxyPage from './proxies'
import RulesPage from './rules'
import SettingPage from './settings'
import UnlockPage from './unlock'

export type NavigationItem = {
  label: (typeof navigationItems)[keyof typeof navigationItems]['label']
  path: string
  icon: LucideIcon
  colorfulIcon: ComponentType<SVGProps<SVGSVGElement>>
  Component: ComponentType
}

export const navItems: NavigationItem[] = [
  {
    ...navigationItems.home,
    icon: HouseIcon,
    colorfulIcon: HomeSvg,
    Component: HomePage,
  },
  {
    ...navigationItems.proxies,
    icon: WifiIcon,
    colorfulIcon: ProxiesSvg,
    Component: ProxyPage,
  },
  {
    ...navigationItems.profiles,
    icon: ServerIcon,
    colorfulIcon: ProfilesSvg,
    Component: ProfilePage,
  },
  {
    ...navigationItems.connections,
    icon: EarthIcon,
    colorfulIcon: ConnectionsSvg,
    Component: ConnectionsPage,
  },
  {
    ...navigationItems.rules,
    icon: ArrowRightLeftIcon,
    colorfulIcon: RulesSvg,
    Component: RulesPage,
  },
  {
    ...navigationItems.logs,
    icon: ScrollTextIcon,
    colorfulIcon: LogsSvg,
    Component: LogsPage,
  },
  {
    ...navigationItems.unlock,
    icon: LockOpenIcon,
    colorfulIcon: UnlockSvg,
    Component: UnlockPage,
  },
  {
    ...navigationItems.settings,
    icon: SettingsIcon,
    colorfulIcon: SettingsSvg,
    Component: SettingPage,
  },
]
