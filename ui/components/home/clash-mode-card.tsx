import { useLockFn } from 'ahooks'
import {
  GlobeIcon,
  type LucideIcon,
  MoveRightIcon,
  SplitIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BaseConfig } from 'tauri-plugin-mihomo-api'

import { useClashMode, useRuntimeConfig } from '@/hooks/use-clash'
import {
  useAppRefreshers,
  useClashConfigData,
  useCoreDataStatus,
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

const MODE_META: Record<
  ClashMode,
  { label: TranslationKey; description: TranslationKey }
> = {
  rule: {
    label: 'home.components.clashMode.labels.rule',
    description: 'home.components.clashMode.descriptions.rule',
  },
  global: {
    label: 'home.components.clashMode.labels.global',
    description: 'home.components.clashMode.descriptions.global',
  },
  direct: {
    label: 'home.components.clashMode.labels.direct',
    description: 'home.components.clashMode.descriptions.direct',
  },
}

const MODE_ICONS: Record<ClashMode, LucideIcon> = {
  rule: SplitIcon,
  global: GlobeIcon,
  direct: MoveRightIcon,
}

export const ClashModeCard = () => {
  const { t } = useTranslation()
  const { clashConfig } = useClashConfigData()
  const { isCoreDataPending } = useCoreDataStatus()
  const { refreshClashConfig } = useAppRefreshers()

  const [optimisticMode, setOptimisticMode] = useState<ClashMode | null>(null)

  const controllerMode = toClashMode(clashConfig?.mode)
  const needFallback = !controllerMode
  const { data: runtimeConfig, isPending: isRuntimeConfigPending } =
    useRuntimeConfig(needFallback)
  const runtimeMode = toClashMode(runtimeConfig?.mode)
  const {
    data: backendMode,
    isPending: isBackendModePending,
    refetch: refetchBackendMode,
  } = useClashMode(needFallback)
  const fallbackMode = toClashMode(backendMode) ?? runtimeMode

  const resolvedMode = controllerMode ?? fallbackMode
  const currentMode = optimisticMode ?? resolvedMode

  const modeDescription = currentMode
    ? t(MODE_META[currentMode].description)
    : isCoreDataPending || isRuntimeConfigPending || isBackendModePending
      ? ' '
      : t('home.components.clashMode.errors.communication')

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
    <div className="flex w-full flex-col gap-3">
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
        {CLASH_MODES.map((mode) => {
          const Icon = MODE_ICONS[mode]
          return (
            <ToggleGroupItem
              key={mode}
              value={mode}
              className="h-8 flex-1 shrink capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <Icon data-icon="inline-start" />
              <span className="truncate">{t(MODE_META[mode].label)}</span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      <div className="rounded-md bg-muted/50 px-3 py-2 text-center text-xs/relaxed break-words text-muted-foreground hyphens-auto">
        {modeDescription}
      </div>
    </div>
  )
}
