import { useLockFn } from 'ahooks'
import dayjs from 'dayjs'
import {
  CalendarDaysIcon,
  CloudUploadIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  GaugeIcon,
  LifeBuoyIcon,
  RefreshCwIcon,
  ServerIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useAppRefreshers } from '@/providers/app-data-context'
import { updateProfile } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { isValidUrl } from '@/utils/network'
import { openExternalUrl } from '@/utils/open-external-url'
import parseTraffic from '@/utils/parse-traffic'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import { Progress } from '@ui/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

import { EnhancedCard } from './enhanced-card'

const parseUrl = (url?: string) => {
  if (!url) return '-'
  if (isValidUrl(url)) return new URL(url).host
  return 'local'
}

const parseExpire = (expire?: number) => {
  if (!expire) return '-'
  return dayjs(expire * 1000).format('YYYY-MM-DD')
}

const openProfileHome = (url: string) => {
  void openExternalUrl(url).catch(showNotice.error)
}

type ProfileItem = IProfileItem

interface HomeProfileCardProps {
  current: ProfileItem | null | undefined
  onProfileUpdated?: () => void
}

const ProfileDetails = ({
  current,
  onUpdateProfile,
  updating,
}: {
  current: ProfileItem
  onUpdateProfile: () => void
  updating: boolean
}) => {
  const { t } = useTranslation()

  const usedTraffic = useMemo(() => {
    if (!current.extra) return 0
    return current.extra.upload + current.extra.download
  }, [current.extra])

  const trafficPercentage = useMemo(() => {
    if (!current.extra || !current.extra.total || current.extra.total <= 0)
      return 0
    return Math.min(Math.round((usedTraffic / current.extra.total) * 100), 100)
  }, [current.extra, usedTraffic])

  return (
    <div className="flex flex-col gap-3 text-muted-foreground">
      {current.url && (
        <div className="flex min-w-0 items-center gap-2">
          <ServerIcon className="size-4 shrink-0" />
          <span className="shrink-0">{t('shared.labels.from')}: </span>
          {current.home ? (
            <button
              type="button"
              onClick={() => current.home && openProfileHome(current.home)}
              className="inline-flex max-w-[calc(100%-40px)] min-w-0 cursor-pointer items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
              title={parseUrl(current.url)}
            >
              <span className="min-w-0 flex-1 truncate">
                {parseUrl(current.url)}
              </span>
              <ExternalLinkIcon className="size-3 shrink-0 opacity-70" />
            </button>
          ) : (
            <span
              className="min-w-0 flex-1 truncate font-medium text-foreground"
              title={parseUrl(current.url)}
            >
              {parseUrl(current.url)}
            </span>
          )}
        </div>
      )}

      {current.updated && (
        <button
          type="button"
          onClick={onUpdateProfile}
          className="flex cursor-pointer items-center gap-2 text-left"
        >
          <RefreshCwIcon
            className={cn('size-4 shrink-0', updating && 'animate-spin')}
          />
          <span>
            {t('shared.labels.updateTime')}:{' '}
            <span className="font-medium text-foreground">
              {dayjs(current.updated * 1000).format('YYYY-MM-DD HH:mm')}
            </span>
          </span>
        </button>
      )}

      {current.extra && (
        <>
          <div className="flex items-center gap-2">
            <GaugeIcon className="size-4 shrink-0" />
            <span>
              {t('shared.labels.usedTotal')}:{' '}
              <span className="font-medium text-foreground">
                {parseTraffic(usedTraffic)} /{' '}
                {parseTraffic(current.extra.total)}
              </span>
            </span>
          </div>

          {current.extra.expire > 0 && (
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 shrink-0" />
              <span>
                {t('shared.labels.expireTime')}:{' '}
                <span className="font-medium text-foreground">
                  {parseExpire(current.extra.expire)}
                </span>
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[0.625rem]">{trafficPercentage}%</span>
            <Progress value={trafficPercentage} className="h-2 bg-primary/10" />
          </div>
        </>
      )}

      {current.hwid_limited && (
        <Badge variant="destructive">
          <TriangleAlertIcon />
          {t('profiles.components.profileItem.labels.hwidLimited')}
        </Badge>
      )}

      {current.announce && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="line-clamp-3 whitespace-pre-line">
              {current.announce}
            </p>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs whitespace-pre-line">
            {current.announce}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

const EmptyProfile = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg py-5 transition-colors hover:bg-muted"
      onClick={onClick}
    >
      <CloudUploadIcon className="mb-2 size-12 text-primary" />
      <span className="text-sm font-medium">
        {t('profiles.page.actions.import')} {t('profiles.page.title')}
      </span>
      <span className="text-muted-foreground">
        {t('profiles.components.card.labels.clickToImport')}
      </span>
    </button>
  )
}

export const HomeProfileCard = ({
  current,
  onProfileUpdated,
}: HomeProfileCardProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refreshAll } = useAppRefreshers()

  const [updating, setUpdating] = useState(false)

  const onUpdateProfile = useLockFn(async () => {
    if (!current?.uid) return

    setUpdating(true)
    try {
      await mutate(
        () => updateProfile(current.uid!, current.option ?? undefined),
        {
          id: `update-profile:${current.uid}`,
          errorNotice: false,
        },
      )
      onProfileUpdated?.()

      refreshAll()
    } catch (err) {
      showNotice.error(err, 3000)
    } finally {
      setUpdating(false)
    }
  })

  const goToProfiles = useCallback(() => {
    navigate('/profile')
  }, [navigate])

  const cardTitle = useMemo(() => {
    if (!current) return t('profiles.page.title')

    if (!current.home) return current.name

    return (
      <button
        type="button"
        onClick={() => current.home && openProfileHome(current.home)}
        className="flex max-w-full min-w-0 cursor-pointer items-center gap-1 font-medium underline-offset-2 hover:underline"
        title={current.name!}
      >
        <span className="flex-1 truncate">{current.name}</span>
        <ExternalLinkIcon className="size-3 shrink-0 opacity-70" />
      </button>
    )
  }, [current, t])

  const cardAction = useMemo(() => {
    if (!current) return null

    const supportUrl = current.support_url

    return (
      <div className="flex items-center gap-1">
        {supportUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t(
                  'profiles.components.profileItem.tooltips.support',
                )}
                onClick={() => openProfileHome(supportUrl)}
              >
                <LifeBuoyIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('profiles.components.profileItem.tooltips.support')}
            </TooltipContent>
          </Tooltip>
        )}
        <Button variant="outline" size="sm" onClick={goToProfiles}>
          {t('layout.components.navigation.tabs.profiles')}
          <DatabaseIcon data-icon="inline-end" />
        </Button>
      </div>
    )
  }, [current, goToProfiles, t])

  return (
    <EnhancedCard
      title={cardTitle}
      icon={<CloudUploadIcon />}
      iconColor="info"
      action={cardAction}
    >
      {current ? (
        <ProfileDetails
          current={current}
          onUpdateProfile={onUpdateProfile}
          updating={updating}
        />
      ) : (
        <EmptyProfile onClick={goToProfiles} />
      )}
    </EnhancedCard>
  )
}
