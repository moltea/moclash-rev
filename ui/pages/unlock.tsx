import { Channel } from '@tauri-apps/api/core'
import { useLockFn } from 'ahooks'
import {
  CircleCheckIcon,
  CircleEllipsisIcon,
  CircleHelpIcon,
  CircleXIcon,
  ClockIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  checkMediaUnlock,
  checkMediaUnlockItem,
  getUnlockItems,
  type UnlockItem,
} from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import { BaseEmpty, BasePage } from '@ui/components/base'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@ui/components/ui/card'
import { Spinner } from '@ui/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

const UNLOCK_RESULTS_STORAGE_KEY = 'clash_verge_unlock_results'

const STATUS_LABEL_KEYS: Record<string, string> = {
  Pending: 'tests.statuses.test.pending',
  Yes: 'tests.statuses.test.yes',
  No: 'tests.statuses.test.no',
  Failed: 'tests.statuses.test.failed',
  Completed: 'tests.statuses.test.completed',
  'Disallowed ISP': 'tests.statuses.test.disallowedIsp',
  'Originals Only': 'tests.statuses.test.originalsOnly',
  'No (IP Banned By Disney+)': 'tests.statuses.test.noDisney',
  'Unsupported Country/Region': 'tests.statuses.test.unsupportedRegion',
  'Failed (Network Connection)': 'tests.statuses.test.failedNetwork',
}

type StatusColor = 'default' | 'success' | 'error' | 'warning' | 'info'

const STATUS_BADGE_CLASS_NAMES: Record<StatusColor, string> = {
  default: 'bg-secondary text-secondary-foreground',
  success: 'bg-success/10 text-success',
  error: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
}

const normalizeUnlockName = (name: string) => name.trim().toLowerCase()

const getStatusPriority = (status: string) => (status === 'Pending' ? 0 : 1)
const mergeOptionalFields = (preferred: UnlockItem, fallback: UnlockItem) => ({
  ...preferred,
  region: preferred.region ?? fallback.region,
  check_time: preferred.check_time ?? fallback.check_time,
})

const dedupeUnlockItems = (items: UnlockItem[]) => {
  const map = new Map<string, UnlockItem>()

  items.forEach((item) => {
    const key = normalizeUnlockName(item.name)
    const existing = map.get(key)

    if (!existing) {
      map.set(key, item)
      return
    }

    const existingPriority = getStatusPriority(existing.status)
    const itemPriority = getStatusPriority(item.status)

    if (itemPriority > existingPriority) {
      map.set(key, mergeOptionalFields(item, existing))
      return
    }

    if (itemPriority < existingPriority) {
      map.set(key, mergeOptionalFields(existing, item))
      return
    }

    map.set(key, mergeOptionalFields(item, existing))
  })

  return Array.from(map.values())
}

const getStatusColor = (status: string): StatusColor => {
  if (status === 'Pending') return 'default'
  if (status === 'Yes') return 'success'
  if (status === 'No') return 'error'
  if (status === 'Soon') return 'warning'
  if (status.includes('Failed')) return 'error'
  if (status === 'Completed') return 'info'
  if (
    status === 'Disallowed ISP' ||
    status === 'Blocked' ||
    status === 'Unsupported Country/Region'
  ) {
    return 'error'
  }
  return 'default'
}

const getStatusIcon = (status: string) => {
  if (status === 'Pending')
    return <CircleEllipsisIcon data-icon="inline-start" />
  if (status === 'Yes') return <CircleCheckIcon data-icon="inline-start" />
  if (status === 'No') return <CircleXIcon data-icon="inline-start" />
  if (status === 'Soon') return <ClockIcon data-icon="inline-start" />
  return <CircleHelpIcon data-icon="inline-start" />
}

const getStatusBorderClassName = (status: string) => {
  if (status === 'Yes') return 'border-s-success'
  if (status === 'No') return 'border-s-destructive'
  if (status === 'Soon') return 'border-s-warning'
  if (status.includes('Failed')) return 'border-s-destructive'
  if (status === 'Completed') return 'border-s-info'
  return 'border-s-border'
}

const UnlockPage = () => {
  const { t } = useTranslation()

  const [unlockItems, setUnlockItems] = useState<UnlockItem[]>([])
  const unlockItemsRef = useRef<UnlockItem[]>([])
  const [isCheckingAll, setIsCheckingAll] = useState(false)
  const [loadingItems, setLoadingItems] = useState<string[]>([])

  const saveResultsToStorage = (items: UnlockItem[]) => {
    try {
      localStorage.setItem(UNLOCK_RESULTS_STORAGE_KEY, JSON.stringify(items))
    } catch (err) {
      console.error('Failed to save results to storage:', err)
    }
  }

  useEffect(() => {
    let storedItems: UnlockItem[] = []
    try {
      const itemsJson = localStorage.getItem(UNLOCK_RESULTS_STORAGE_KEY)
      if (itemsJson) {
        storedItems = dedupeUnlockItems(JSON.parse(itemsJson) as UnlockItem[])
      }
    } catch (err) {
      console.error('Failed to load results from storage:', err)
    }

    void (async () => {
      try {
        const defaultItems = await getUnlockItems()
        const existingMap = new Map(
          storedItems.map((item) => [normalizeUnlockName(item.name), item]),
        )
        const mergedItems = defaultItems.map((item) => {
          const matchedItem = existingMap.get(normalizeUnlockName(item.name))
          return matchedItem ? { ...matchedItem, name: item.name } : item
        })

        const sortedItems = mergedItems.sort((a, b) =>
          a.name.localeCompare(b.name),
        )
        unlockItemsRef.current = sortedItems
        setUnlockItems(sortedItems)
      } catch (err: any) {
        console.error('Failed to get unlock items:', err)
      }
    })()
  }, [])

  const checkAllMedia = useLockFn(async () => {
    const onComplete = new Channel<UnlockItem>((result) => {
      const updatedItems = unlockItemsRef.current.map((item) =>
        item.name === result.name ? result : item,
      )
      unlockItemsRef.current = updatedItems
      setUnlockItems(updatedItems)
      setLoadingItems((items) => items.filter((name) => name !== result.name))
    })

    try {
      setIsCheckingAll(true)
      setLoadingItems(unlockItems.map((item) => item.name))
      const result = await checkMediaUnlock(onComplete)
      const sortedItems = result.sort((a, b) => a.name.localeCompare(b.name))

      unlockItemsRef.current = sortedItems
      setUnlockItems(sortedItems)
      saveResultsToStorage(sortedItems)
    } catch (err: any) {
      showNotice.error('tests.unlock.page.messages.detectionTimeout', err)
      console.error('Failed to check media unlock:', err)
    } finally {
      setLoadingItems([])
      setIsCheckingAll(false)
    }
  })

  const checkSingleMedia = async (name: string) => {
    setLoadingItems((items) => [...items, name])
    try {
      const result = await checkMediaUnlockItem(name)
      const updatedItems = unlockItemsRef.current.map((item) =>
        item.name === name ? result : item,
      )

      unlockItemsRef.current = updatedItems
      setUnlockItems(updatedItems)
      saveResultsToStorage(updatedItems)
    } catch (err: any) {
      showNotice.error(
        'tests.unlock.page.messages.detectionFailedWithName',
        { name },
        err,
      )
      console.error(`Failed to check ${name}:`, err)
    } finally {
      setLoadingItems((items) => items.filter((item) => item !== name))
    }
  }

  return (
    <BasePage
      title={t('tests.unlock.page.title')}
      header={
        <Button
          size="sm"
          disabled={
            unlockItems.length === 0 || isCheckingAll || loadingItems.length > 0
          }
          onClick={checkAllMedia}
        >
          {isCheckingAll ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCwIcon data-icon="inline-start" />
          )}
          {isCheckingAll
            ? t('tests.unlock.page.actions.testing')
            : t('tests.page.actions.testAll')}
        </Button>
      }
    >
      {unlockItems.length === 0 ? (
        <div className="flex h-1/2 items-center justify-center">
          <BaseEmpty textKey="tests.unlock.page.empty" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {unlockItems.map((item) => {
            const isLoading = loadingItems.includes(item.name)

            return (
              <Card
                key={item.name}
                size="sm"
                className={cn(
                  'h-full gap-2 border-s-4 pb-0 transition-colors hover:bg-muted/40',
                  getStatusBorderClassName(item.status),
                )}
              >
                <CardHeader>
                  <CardTitle className="truncate font-semibold">
                    {item.name}
                  </CardTitle>
                  <CardAction>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="rounded-full"
                            aria-label={t('tests.components.item.actions.test')}
                            disabled={isLoading || isCheckingAll}
                            onClick={() => checkSingleMedia(item.name)}
                          >
                            <RefreshCwIcon
                              className={cn(isLoading && 'animate-spin')}
                            />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {t('tests.components.item.actions.test')}
                      </TooltipContent>
                    </Tooltip>
                  </CardAction>
                </CardHeader>

                <CardContent className="flex flex-1 flex-wrap items-center gap-1.5">
                  <Badge
                    className={cn(
                      STATUS_BADGE_CLASS_NAMES[getStatusColor(item.status)],
                      item.status === 'Pending'
                        ? 'font-normal'
                        : 'font-semibold',
                    )}
                  >
                    {getStatusIcon(item.status)}
                    {t(STATUS_LABEL_KEYS[item.status] ?? item.status)}
                  </Badge>

                  {item.region && (
                    <Badge variant="outline" className="text-info">
                      {item.region}
                    </Badge>
                  )}
                </CardContent>

                <CardFooter className="justify-end border-t border-dashed py-1.5">
                  <span className="text-[0.625rem] text-muted-foreground tabular-nums">
                    {item.check_time || '-- --'}
                  </span>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </BasePage>
  )
}

export default UnlockPage
