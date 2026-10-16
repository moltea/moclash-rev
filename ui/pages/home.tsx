import { useLockFn } from 'ahooks'
import {
  CircleHelpIcon,
  FeatherIcon,
  GaugeIcon,
  type LucideIcon,
  NetworkIcon,
  RouterIcon,
  SettingsIcon,
} from 'lucide-react'
import { Suspense, lazy, useCallback, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useProfiles } from '@/hooks/use-profiles'
import { useVerge } from '@/hooks/use-verge'
import { entry_lightweight_mode } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import type { TranslationKey } from '@/types/generated/i18n-keys'
import { openExternalUrl } from '@/utils/open-external-url'
import { BaseDialog, BasePage } from '@ui/components/base'
import { ClashModeCard } from '@ui/components/home/clash-mode-card'
import { CurrentProxyCard } from '@ui/components/home/current-proxy-card'
import { EnhancedCard } from '@ui/components/home/enhanced-card'
import { EnhancedTrafficStats } from '@ui/components/home/enhanced-traffic-stats'
import { HomeProfileCard } from '@ui/components/home/home-profile-card'
import { ProxyTunCard } from '@ui/components/home/proxy-tun-card'
import { Button } from '@ui/components/ui/button'
import { Checkbox } from '@ui/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import { Skeleton } from '@ui/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

const preloadTestCard = () =>
  import('@ui/components/home/test-card').then((module) => ({
    default: module.TestCard,
  }))
const preloadIpInfoCard = () =>
  import('@ui/components/home/ip-info-card').then((module) => ({
    default: module.IpInfoCard,
  }))
const preloadClashInfoCard = () =>
  import('@ui/components/home/clash-info-card').then((module) => ({
    default: module.ClashInfoCard,
  }))
const preloadSystemInfoCard = () =>
  import('@ui/components/home/system-info-card').then((module) => ({
    default: module.SystemInfoCard,
  }))

const LazyTestCard = lazy(preloadTestCard)
const LazyIpInfoCard = lazy(preloadIpInfoCard)
const LazyClashInfoCard = lazy(preloadClashInfoCard)
const LazySystemInfoCard = lazy(preloadSystemInfoCard)

// eslint-disable-next-line react-refresh/only-export-components
export const preloadHomePageCards = () =>
  Promise.all([
    preloadTestCard().catch(() => {}),
    preloadIpInfoCard().catch(() => {}),
    preloadClashInfoCard().catch(() => {}),
    preloadSystemInfoCard().catch(() => {}),
  ])

interface HomeCardsSettings {
  profile: boolean
  proxy: boolean
  network: boolean
  mode: boolean
  traffic: boolean
  info: boolean
  clashinfo: boolean
  systeminfo: boolean
  test: boolean
  ip: boolean
  [key: string]: boolean
}

const DEFAULT_HOME_CARDS: HomeCardsSettings = {
  info: false,
  profile: true,
  proxy: true,
  network: true,
  mode: true,
  traffic: true,
  clashinfo: true,
  systeminfo: true,
  test: true,
  ip: true,
}

const HOME_CARD_OPTIONS: { key: string; label: TranslationKey }[] = [
  { key: 'profile', label: 'home.page.settings.cards.profile' },
  { key: 'proxy', label: 'home.page.settings.cards.currentProxy' },
  { key: 'network', label: 'home.page.settings.cards.network' },
  { key: 'mode', label: 'home.page.settings.cards.proxyMode' },
  { key: 'traffic', label: 'home.page.settings.cards.traffic' },
  { key: 'test', label: 'home.page.settings.cards.tests' },
  { key: 'ip', label: 'home.page.settings.cards.ip' },
  { key: 'clashinfo', label: 'home.page.settings.cards.clashInfo' },
  { key: 'systeminfo', label: 'home.page.settings.cards.systemInfo' },
]

const serializeCardFlags = (cards: HomeCardsSettings) =>
  Object.keys(cards)
    .sort()
    .map((key) => `${key}:${cards[key] ? 1 : 0}`)
    .join('|')

interface HomeSettingsDialogProps {
  onClose: () => void
  homeCards: HomeCardsSettings
}

const HomeSettingsDialog = ({
  onClose,
  homeCards,
}: HomeSettingsDialogProps) => {
  const { t } = useTranslation()
  const id = useId()
  const [cards, setCards] = useState<HomeCardsSettings>(homeCards)
  const { patchVerge } = useVerge()

  const handleToggle = (key: string) => {
    setCards((prev: HomeCardsSettings) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSave = async () => {
    await patchVerge({ home_cards: cards })
    onClose()
  }

  return (
    <BaseDialog
      open
      title={t('home.page.settings.title')}
      className="sm:max-w-xs"
      okBtn={t('shared.actions.save')}
      cancelBtn={t('shared.actions.cancel')}
      onOk={handleSave}
      onCancel={onClose}
      onClose={onClose}
    >
      <FieldGroup className="gap-3 py-1">
        {HOME_CARD_OPTIONS.map(({ key, label }) => (
          <Field key={key} orientation="horizontal">
            <Checkbox
              id={`${id}-${key}`}
              checked={cards[key] || false}
              onCheckedChange={() => handleToggle(key)}
            />
            <FieldLabel htmlFor={`${id}-${key}`} className="font-normal">
              {t(label)}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>
    </BaseDialog>
  )
}

interface HeaderActionProps {
  title: string
  icon: LucideIcon
  onClick: () => void
}

const HeaderAction = ({ title, icon: Icon, onClick }: HeaderActionProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClick}
        aria-label={title}
      >
        <Icon />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{title}</TooltipContent>
  </Tooltip>
)

const CardFallback = () => <Skeleton className="h-[200px] w-full rounded-lg" />

const HomePage = () => {
  const { t } = useTranslation()
  const { verge } = useVerge()
  const { current, mutateProfiles } = useProfiles()

  const [settingsOpen, setSettingsOpen] = useState(false)

  const homeCards =
    (verge?.home_cards as HomeCardsSettings | undefined) ?? DEFAULT_HOME_CARDS

  const toGithubDoc = useLockFn(() =>
    openExternalUrl('https://github.com/moltea/moclash-rev#readme').catch(
      showNotice.error,
    ),
  )

  const openSettings = useCallback(() => {
    setSettingsOpen(true)
  }, [])

  const renderCard = useCallback(
    (cardKey: string, component: React.ReactNode, size: number = 6) => {
      if (!homeCards[cardKey]) return null

      return (
        <div
          key={cardKey}
          className={cn('min-w-0', size === 12 && '@3xl/home:col-span-2')}
        >
          {component}
        </div>
      )
    },
    [homeCards],
  )

  const criticalCards = useMemo(
    () => [
      renderCard(
        'profile',
        <HomeProfileCard current={current} onProfileUpdated={mutateProfiles} />,
      ),
      renderCard('proxy', <CurrentProxyCard />),
      renderCard('network', <NetworkSettingsCard />),
      renderCard('mode', <ClashModeEnhancedCard />),
    ],
    [current, mutateProfiles, renderCard],
  )

  const nonCriticalCards = useMemo(
    () => [
      renderCard(
        'traffic',
        <EnhancedCard
          title={t('home.page.cards.trafficStats')}
          icon={<GaugeIcon />}
          iconColor="secondary"
        >
          <EnhancedTrafficStats />
        </EnhancedCard>,
        12,
      ),
      renderCard(
        'test',
        <Suspense fallback={<CardFallback />}>
          <LazyTestCard />
        </Suspense>,
      ),
      renderCard(
        'ip',
        <Suspense fallback={<CardFallback />}>
          <LazyIpInfoCard />
        </Suspense>,
      ),
      renderCard(
        'clashinfo',
        <Suspense fallback={<CardFallback />}>
          <LazyClashInfoCard />
        </Suspense>,
      ),
      renderCard(
        'systeminfo',
        <Suspense fallback={<CardFallback />}>
          <LazySystemInfoCard />
        </Suspense>,
      ),
    ],
    [t, renderCard],
  )

  return (
    <BasePage
      title={t('home.page.title')}
      header={
        <>
          <HeaderAction
            title={t('home.page.tooltips.lightweightMode')}
            icon={FeatherIcon}
            onClick={async () =>
              await mutate(() => entry_lightweight_mode(), {
                id: 'entry-lightweight-mode',
                errorNotice: false,
              })
            }
          />
          <HeaderAction
            title={t('home.page.tooltips.manual')}
            icon={CircleHelpIcon}
            onClick={toGithubDoc}
          />
          <HeaderAction
            title={t('home.page.tooltips.settings')}
            icon={SettingsIcon}
            onClick={openSettings}
          />
        </>
      }
    >
      <div className="@container/home">
        <div className="grid grid-cols-1 gap-3 @3xl/home:grid-cols-2">
          {criticalCards}

          {nonCriticalCards}
        </div>
      </div>

      {settingsOpen && (
        <HomeSettingsDialog
          key={serializeCardFlags(homeCards)}
          onClose={() => setSettingsOpen(false)}
          homeCards={homeCards}
        />
      )}
    </BasePage>
  )
}

const NetworkSettingsCard = () => {
  const { t } = useTranslation()
  return (
    <EnhancedCard
      title={t('home.page.cards.networkSettings')}
      icon={<NetworkIcon />}
      iconColor="primary"
      action={null}
    >
      <ProxyTunCard />
    </EnhancedCard>
  )
}

const ClashModeEnhancedCard = () => {
  const { t } = useTranslation()
  return (
    <EnhancedCard
      title={t('home.page.cards.proxyMode')}
      icon={<RouterIcon />}
      iconColor="info"
      action={null}
    >
      <ClashModeCard />
    </EnhancedCard>
  )
}

export default HomePage
