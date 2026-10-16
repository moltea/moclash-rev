import { useLockFn } from 'ahooks'
import { ArrowUpCircleIcon, RotateCcwIcon } from 'lucide-react'
import type { Ref } from 'react'
import { useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { closeAllConnections } from 'tauri-plugin-mihomo-api'

import { useClash, useClashInfo } from '@/hooks/use-clash'
import { useVerge } from '@/hooks/use-verge'
import { changeClashCore, restartCore, upgradeClashCore } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { BaseDialog, type DialogRef } from '@ui/components/base'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@ui/components/ui/item'
import { Spinner } from '@ui/components/ui/spinner'

const VALID_CORE = [
  {
    name: 'Mihomo',
    core: 'verge-mihomo',
    chipKey: 'settings.modals.clashCore.variants.release',
  },
  {
    name: 'Mihomo Alpha',
    core: 'verge-mihomo-alpha',
    chipKey: 'settings.modals.clashCore.variants.alpha',
  },
] as const

export function ClashCoreViewer({ ref }: { ref?: Ref<DialogRef> }) {
  const { t } = useTranslation()

  const { verge, mutateVerge } = useVerge()
  const { mutateVersion } = useClash()
  const { invalidateClashConfig } = useClashInfo()

  const [open, setOpen] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [changingCore, setChangingCore] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }))

  const { clash_core = 'verge-mihomo' } = verge ?? {}

  const onCoreChange = useLockFn(async (core: string) => {
    if (core === clash_core) return

    try {
      setChangingCore(core)
      void mutate(() => closeAllConnections(), {
        id: 'close-all-connections',
        errorNotice: false,
      })
      const result = await mutate(() => changeClashCore(core), {
        id: 'change-clash-core',
        errorNotice: false,
      })
      if (!result.ok) return
      const errorMsg = result.value

      if (errorMsg) {
        showNotice.error(errorMsg)
        setChangingCore(null)
        return
      }

      mutateVerge()
      await new Promise((resolve) => setTimeout(resolve, 500))
      invalidateClashConfig()
      mutateVersion()
    } catch (err) {
      showNotice.error(err)
    } finally {
      setChangingCore(null)
    }
  })

  const onRestart = useLockFn(async () => {
    try {
      setRestarting(true)
      await mutate(() => restartCore(), {
        id: 'restart-core',
        successNotice: t(
          'settings.feedback.notifications.clash.restartSuccess',
        ),
      })
      setRestarting(false)
    } catch {
      setRestarting(false)
    }
  })

  const onUpgrade = useLockFn(async () => {
    try {
      setUpgrading(true)
      await mutate(() => upgradeClashCore(), {
        id: 'upgrade-clash-core',
        onFulfilled: (report) => {
          showNotice.success(
            report.upgraded
              ? t('settings.feedback.notifications.clash.versionUpdated')
              : t('settings.feedback.notifications.clash.alreadyLatestVersion'),
          )
        },
      })
    } catch {
    } finally {
      setUpgrading(false)
    }
  })

  return (
    <BaseDialog
      open={open}
      title={
        <div className="flex items-center justify-between gap-2 pe-6">
          {t('settings.sections.clash.form.fields.clashCore')}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={upgrading || restarting || changingCore !== null}
              onClick={onUpgrade}
            >
              {upgrading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ArrowUpCircleIcon data-icon="inline-start" />
              )}
              {t('shared.actions.upgrade')}
            </Button>
            <Button
              size="sm"
              disabled={restarting || upgrading}
              onClick={onRestart}
            >
              {restarting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RotateCcwIcon data-icon="inline-start" />
              )}
              {t('shared.actions.restart')}
            </Button>
          </div>
        </div>
      }
      className="sm:max-w-md"
      contentClassName="select-text"
      disableOk
      cancelBtn={t('shared.actions.close')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
    >
      <ItemGroup className="gap-2 py-1">
        {VALID_CORE.map((each) => {
          const selected = each.core === clash_core
          return (
            <Item
              key={each.core}
              size="sm"
              variant={selected ? 'muted' : 'outline'}
              asChild
            >
              <button
                type="button"
                aria-pressed={selected}
                className="w-full text-start not-disabled:hover:bg-muted/50 disabled:opacity-50"
                disabled={changingCore !== null || restarting || upgrading}
                onClick={() => onCoreChange(each.core)}
              >
                <ItemContent>
                  <ItemTitle>{each.name}</ItemTitle>
                  <ItemDescription>{`/${each.core}`}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {changingCore === each.core ? (
                    <Spinner />
                  ) : (
                    <Badge variant={selected ? 'default' : 'secondary'}>
                      {t(each.chipKey)}
                    </Badge>
                  )}
                </ItemActions>
              </button>
            </Item>
          )
        })}
      </ItemGroup>
    </BaseDialog>
  )
}
