import { useLockFn } from 'ahooks'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BaseConfig } from 'tauri-plugin-mihomo-api'

import { useClashMode } from '@/hooks/use-clash'
import {
  useAppRefreshers,
  useClashConfigData,
} from '@/providers/app-data-context'
import { patchClashMode } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { setCacheData } from '@/services/query-client'
import type { TranslationKey } from '@/types/generated/i18n-keys'
import { ToggleGroup, ToggleGroupItem } from '@ui/components/ui/toggle-group'

const CLASH_MODES = ['rule', 'global', 'direct'] as const
type ClashMode = (typeof CLASH_MODES)[number]

const isClashMode = (mode: string): mode is ClashMode =>
  (CLASH_MODES as readonly string[]).includes(mode)

const toClashMode = (mode?: string | null) => {
  const normalized = mode?.toLowerCase()
  return normalized && isClashMode(normalized) ? normalized : undefined
}

const MODE_LABELS: Record<ClashMode, TranslationKey> = {
  rule: 'home.components.clashMode.labels.rule',
  global: 'home.components.clashMode.labels.global',
  direct: 'home.components.clashMode.labels.direct',
}

export const QuickPanelMode = () => {
  const { t } = useTranslation()
  const { clashConfig } = useClashConfigData()
  const { refreshClashConfig } = useAppRefreshers()
  const [optimisticMode, setOptimisticMode] = useState<ClashMode | null>(null)

  const controllerMode = toClashMode(clashConfig?.mode)
  const { data: backendMode, refetch: refetchBackendMode } = useClashMode(
    !controllerMode,
  )
  const currentMode =
    optimisticMode ?? controllerMode ?? toClashMode(backendMode)

  const onChangeMode = useLockFn(async (mode: ClashMode) => {
    if (mode === currentMode) return

    setOptimisticMode(mode)
    try {
      await mutate(() => patchClashMode(mode), {
        id: 'patch-clash-mode',
        errorNotice: false,
      })
    } catch (error) {
      setOptimisticMode(null)
      showNotice.error(error)
      return
    }

    setCacheData<BaseConfig>(['getClashConfig'], (old) =>
      old ? { ...old, mode } : old,
    )
    await Promise.allSettled([refreshClashConfig(), refetchBackendMode()])
    setOptimisticMode(null)
  })

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={0}
      value={currentMode ?? ''}
      onValueChange={(value) => {
        if (isClashMode(value)) onChangeMode(value)
      }}
      className="w-full"
    >
      {CLASH_MODES.map((mode) => (
        <ToggleGroupItem
          key={mode}
          value={mode}
          className="h-8 min-w-0 flex-1 shrink px-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <span className="truncate">{t(MODE_LABELS[mode])}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
