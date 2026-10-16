import { useLockFn } from 'ahooks'
import { GlobeIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useIconCache } from '@/hooks/use-icon-cache'
import { cmdTestDelay } from '@/services/cmds'
import delayManager from '@/services/delay'
import { showNotice } from '@/services/notice-service'
import { useTestAllCounter } from '@/store/app-store-context'
import { BaseLoading } from '@ui/components/base'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@ui/components/ui/context-menu'
import { Separator } from '@ui/components/ui/separator'
import { cn } from '@ui/lib/utils'

import { TestBox } from './test-box'

interface Props {
  itemData: IVergeTestItem
  onEdit: () => void
  onDelete: (uid: string) => void
}

const DELAY_COLOR_CLASSES: Record<string, string> = {
  'success.main': 'text-success',
  'primary.main': 'text-info',
  'warning.main': 'text-warning',
  'error.main': 'text-destructive',
}

const widgetClassName =
  'rounded-sm px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-primary/15'

export const TestItem = ({ itemData, onEdit, onDelete: removeTest }: Props) => {
  const { t } = useTranslation()
  const [delay, setDelay] = useState(-1)
  const { uid, name, icon, url } = itemData
  const iconCachePath = useIconCache({ icon: icon!, cacheKey: uid! })

  const onDelay = useCallback(async () => {
    setDelay(-2)
    try {
      const result = await cmdTestDelay(url!)
      setDelay(result)
    } catch (err) {
      setDelay(-1)
      showNotice.error(err)
    }
  }, [url])

  const onEditTest = () => {
    onEdit()
  }

  const onDelete = useLockFn(async () => {
    try {
      removeTest(uid!)
    } catch (err: any) {
      showNotice.error(err)
    }
  })

  const menu = [
    { label: t('shared.actions.edit'), handler: onEditTest },
    { label: t('shared.actions.delete'), handler: onDelete },
  ]

  const testAllCounter = useTestAllCounter()
  const onDelayRef = useRef(onDelay)
  onDelayRef.current = onDelay
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    void onDelayRef.current()
  }, [testAllCounter])

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <TestBox>
            <div data-sortable-handle className="relative cursor-move">
              {icon && icon.trim() !== '' ? (
                <div className="flex justify-center">
                  {icon.trim().startsWith('http') && (
                    <img
                      alt={name!}
                      src={iconCachePath === '' ? icon : iconCachePath}
                      className="h-10"
                    />
                  )}
                  {icon.trim().startsWith('data') && (
                    <img alt={name!} src={icon!} className="h-10" />
                  )}
                  {icon.trim().startsWith('<svg') && (
                    <img
                      alt={name!}
                      src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon)}`}
                      className="h-10"
                    />
                  )}
                </div>
              ) : (
                <div className="flex justify-center">
                  <GlobeIcon className="size-10 p-1" />
                </div>
              )}

              <div className="flex justify-center truncate text-foreground">
                {name}
              </div>
            </div>
            <Separator className="mt-2" />
            <div className="mt-2 flex justify-center text-primary">
              {delay === -2 && (
                <div className={cn(widgetClassName, 'hover:bg-transparent')}>
                  <BaseLoading />
                </div>
              )}

              {delay === -1 && (
                <button
                  type="button"
                  className={cn('the-check', widgetClassName)}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDelay()
                  }}
                >
                  {t('tests.components.item.actions.test')}
                </button>
              )}

              {delay >= 0 && (
                <button
                  type="button"
                  className={cn(
                    'the-delay',
                    widgetClassName,
                    DELAY_COLOR_CLASSES[delayManager.formatDelayColor(delay)],
                  )}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onDelay()
                  }}
                >
                  {delayManager.formatDelay(delay)}
                </button>
              )}
            </div>
          </TestBox>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {menu.map((item) => (
            <ContextMenuItem
              key={item.label}
              onSelect={item.handler}
              className="min-w-30"
            >
              {item.label}
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}
