import { convertFileSrc } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { exists } from '@tauri-apps/plugin-fs'
import {
  forwardRef,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { GuardState } from '@/components/setting/mods/guard-state'
import { useVerge } from '@/hooks/use-verge'
import { useWindowDecorations } from '@/hooks/use-window'
import { copyIconFile, getAppDir } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import getSystem from '@/utils/get-system'
import { BaseDialog, type DialogRef, TooltipIcon } from '@ui/components/base'
import { DEFAULT_HOVER_DELAY } from '@ui/components/proxy/proxy-group-navigator'
import { Button } from '@ui/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@ui/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/ui/select'
import { Switch } from '@ui/components/ui/switch'

const OS = getSystem()

const clampHoverDelay = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_HOVER_DELAY
  }
  return Math.min(5000, Math.max(0, Math.round(value)))
}

const getIcons = async (icon_dir: string, name: string) => {
  const updateTime = localStorage.getItem(`icon_${name}_update_time`) || ''

  const icon_png = await join(icon_dir, `${name}-${updateTime}.png`)
  const icon_ico = await join(icon_dir, `${name}-${updateTime}.ico`)

  return {
    icon_png,
    icon_ico,
  }
}

const Row = ({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) => (
  <Field orientation="horizontal">
    <FieldLabel>{label}</FieldLabel>
    {children}
  </Field>
)

const TipRow = ({
  label,
  tip,
  children,
}: {
  label: string
  tip: string
  children: ReactNode
}) => (
  <Field orientation="horizontal">
    <div className="flex flex-1 items-center gap-1">
      <FieldLabel>{label}</FieldLabel>
      <TooltipIcon title={tip} />
    </div>
    {children}
  </Field>
)

export const LayoutViewer = forwardRef<DialogRef>((_, ref) => {
  const { t } = useTranslation()
  const { verge, patchVerge, mutateVerge } = useVerge()

  const [open, setOpen] = useState(false)
  const [commonIcon, setCommonIcon] = useState('')
  const [sysproxyIcon, setSysproxyIcon] = useState('')
  const [tunIcon, setTunIcon] = useState('')

  const { decorated, toggleDecorations } = useWindowDecorations()

  useEffect(() => {
    initIconPath()
  }, [])

  async function initIconPath() {
    const appDir = await getAppDir()

    const icon_dir = await join(appDir, 'icons')

    const { icon_png: common_icon_png, icon_ico: common_icon_ico } =
      await getIcons(icon_dir, 'common')

    const { icon_png: sysproxy_icon_png, icon_ico: sysproxy_icon_ico } =
      await getIcons(icon_dir, 'sysproxy')

    const { icon_png: tun_icon_png, icon_ico: tun_icon_ico } = await getIcons(
      icon_dir,
      'tun',
    )

    if (await exists(common_icon_ico)) {
      setCommonIcon(common_icon_ico)
    } else {
      setCommonIcon(common_icon_png)
    }
    if (await exists(sysproxy_icon_ico)) {
      setSysproxyIcon(sysproxy_icon_ico)
    } else {
      setSysproxyIcon(sysproxy_icon_png)
    }
    if (await exists(tun_icon_ico)) {
      setTunIcon(tun_icon_ico)
    } else {
      setTunIcon(tun_icon_png)
    }
  }

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }))

  const onError = (err: any) => {
    showNotice.error(err)
  }
  const onChangeData = (patch: Partial<IVergeConfig>) => {
    mutateVerge({ ...verge, ...patch }, false)
  }

  const renderIconButton = (
    enabled: boolean | null | undefined,
    iconPath: string,
    onClick: () => void,
  ) => (
    <Button variant="outline" size="sm" onClick={onClick}>
      {enabled && iconPath && (
        <img
          alt=""
          data-icon="inline-start"
          className="h-4 w-auto"
          src={convertFileSrc(iconPath)}
        />
      )}
      {enabled
        ? t('shared.actions.clear')
        : t('settings.components.verge.basic.actions.browse')}
    </Button>
  )

  return (
    <BaseDialog
      open={open}
      title={t('settings.components.verge.layout.title')}
      className="sm:max-w-lg"
      disableOk
      cancelBtn={t('shared.actions.close')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
    >
      <FieldGroup className="gap-3 py-1">
        <Row
          label={t(
            'settings.components.verge.layout.fields.preferSystemTitlebar',
          )}
        >
          <GuardState
            value={decorated}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onCatch={onError}
            onChange={async () => {
              await toggleDecorations()
            }}
          >
            <Switch />
          </GuardState>
        </Row>

        <Row label={t('settings.components.verge.layout.fields.trafficGraph')}>
          <GuardState
            value={verge?.traffic_graph ?? true}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onCatch={onError}
            onChange={(e) => onChangeData({ traffic_graph: e })}
            onGuard={(e) => patchVerge({ traffic_graph: e })}
          >
            <Switch />
          </GuardState>
        </Row>

        <Row label={t('settings.components.verge.layout.fields.memoryUsage')}>
          <GuardState
            value={verge?.enable_memory_usage ?? true}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onCatch={onError}
            onChange={(e) => onChangeData({ enable_memory_usage: e })}
            onGuard={(e) => patchVerge({ enable_memory_usage: e })}
          >
            <Switch />
          </GuardState>
        </Row>

        <Row
          label={t('settings.components.verge.layout.fields.proxyGroupIcon')}
        >
          <GuardState
            value={verge?.enable_group_icon ?? true}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onCatch={onError}
            onChange={(e) => onChangeData({ enable_group_icon: e })}
            onGuard={(e) => patchVerge({ enable_group_icon: e })}
          >
            <Switch />
          </GuardState>
        </Row>

        <Row
          label={t(
            'settings.components.verge.layout.fields.pauseRenderTrafficStatsOnBlur',
          )}
        >
          <GuardState
            value={verge?.pause_render_traffic_stats_on_blur ?? true}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onCatch={onError}
            onChange={(e) =>
              onChangeData({ pause_render_traffic_stats_on_blur: e })
            }
            onGuard={(e) =>
              patchVerge({ pause_render_traffic_stats_on_blur: e })
            }
          >
            <Switch />
          </GuardState>
        </Row>

        <Row label={t('settings.components.verge.layout.fields.toastPosition')}>
          <GuardState
            value={verge?.notice_position ?? 'top-right'}
            onChangeProps="onValueChange"
            onCatch={onError}
            onChange={(value) => onChangeData({ notice_position: value })}
            onGuard={(value) => patchVerge({ notice_position: value })}
          >
            <Select>
              <SelectTrigger size="sm" className="w-auto min-w-44 max-w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-right">
                  {t(
                    'settings.components.verge.layout.options.toastPosition.topRight',
                  )}
                </SelectItem>
                <SelectItem value="top-left">
                  {t(
                    'settings.components.verge.layout.options.toastPosition.topLeft',
                  )}
                </SelectItem>
                <SelectItem value="bottom-right">
                  {t(
                    'settings.components.verge.layout.options.toastPosition.bottomRight',
                  )}
                </SelectItem>
                <SelectItem value="bottom-left">
                  {t(
                    'settings.components.verge.layout.options.toastPosition.bottomLeft',
                  )}
                </SelectItem>
              </SelectContent>
            </Select>
          </GuardState>
        </Row>

        <TipRow
          label={t('settings.components.verge.layout.fields.hoverNavigator')}
          tip={t('settings.components.verge.layout.tooltips.hoverNavigator')}
        >
          <GuardState
            value={verge?.enable_hover_jump_navigator ?? true}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onCatch={onError}
            onChange={(e) => onChangeData({ enable_hover_jump_navigator: e })}
            onGuard={(e) => patchVerge({ enable_hover_jump_navigator: e })}
          >
            <Switch />
          </GuardState>
        </TipRow>

        <TipRow
          label={t(
            'settings.components.verge.layout.fields.hoverNavigatorDelay',
          )}
          tip={t(
            'settings.components.verge.layout.tooltips.hoverNavigatorDelay',
          )}
        >
          <InputGroup
            className="w-32"
            data-disabled={!(verge?.enable_hover_jump_navigator ?? true)}
          >
            <GuardState
              value={verge?.hover_jump_navigator_delay ?? DEFAULT_HOVER_DELAY}
              waitTime={400}
              onCatch={onError}
              onFormat={(e: any) => clampHoverDelay(Number(e.target.value))}
              onChange={(value) =>
                onChangeData({
                  hover_jump_navigator_delay: clampHoverDelay(value),
                })
              }
              onGuard={(value) =>
                patchVerge({
                  hover_jump_navigator_delay: clampHoverDelay(value),
                })
              }
            >
              <InputGroupInput
                type="number"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                min={0}
                max={5000}
                step={20}
                disabled={!(verge?.enable_hover_jump_navigator ?? true)}
              />
            </GuardState>
            <InputGroupAddon align="inline-end">
              <InputGroupText>{t('shared.units.milliseconds')}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </TipRow>

        <Row label={t('settings.components.verge.layout.fields.navIcon')}>
          <GuardState
            value={verge?.menu_icon ?? 'monochrome'}
            onChangeProps="onValueChange"
            onCatch={onError}
            onChange={(value) => onChangeData({ menu_icon: value })}
            onGuard={(value) => patchVerge({ menu_icon: value })}
          >
            <Select>
              <SelectTrigger size="sm" className="w-auto min-w-36 max-w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monochrome">
                  {t(
                    'settings.components.verge.layout.options.icon.monochrome',
                  )}
                </SelectItem>
                <SelectItem value="colorful">
                  {t('settings.components.verge.layout.options.icon.colorful')}
                </SelectItem>
                <SelectItem value="disable">
                  {t('settings.components.verge.layout.options.icon.disable')}
                </SelectItem>
              </SelectContent>
            </Select>
          </GuardState>
        </Row>

        <Row
          label={t('settings.components.verge.layout.fields.collapseNavBar')}
        >
          <GuardState
            value={verge?.collapse_navbar ?? false}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onCatch={onError}
            onChange={(e) => onChangeData({ collapse_navbar: e })}
            onGuard={(e) => patchVerge({ collapse_navbar: e })}
          >
            <Switch />
          </GuardState>
        </Row>

        {OS === 'macos' && (
          <Row label={t('settings.components.verge.layout.fields.trayIcon')}>
            <GuardState
              value={verge?.tray_icon ?? 'monochrome'}
              onChangeProps="onValueChange"
              onCatch={onError}
              onChange={(e) => onChangeData({ tray_icon: e })}
              onGuard={(e) => patchVerge({ tray_icon: e })}
            >
              <Select>
                <SelectTrigger size="sm" className="w-auto min-w-36 max-w-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monochrome">
                    {t(
                      'settings.components.verge.layout.options.icon.monochrome',
                    )}
                  </SelectItem>
                  <SelectItem value="colorful">
                    {t(
                      'settings.components.verge.layout.options.icon.colorful',
                    )}
                  </SelectItem>
                </SelectContent>
              </Select>
            </GuardState>
          </Row>
        )}
        {OS === 'macos' && (
          <Row
            label={t('settings.components.verge.layout.fields.enableTraySpeed')}
          >
            <GuardState
              value={verge?.enable_tray_speed ?? false}
              valueProps="checked"
              onChangeProps="onCheckedChange"
              onCatch={onError}
              onChange={(e) => onChangeData({ enable_tray_speed: e })}
              onGuard={(e) => patchVerge({ enable_tray_speed: e })}
            >
              <Switch />
            </GuardState>
          </Row>
        )}

        <Row
          label={t(
            'settings.components.verge.layout.fields.proxyGroupsDisplayMode',
          )}
        >
          <GuardState
            value={verge?.tray_proxy_groups_display_mode ?? 'default'}
            onChangeProps="onValueChange"
            onCatch={onError}
            onChange={(value) =>
              onChangeData({ tray_proxy_groups_display_mode: value })
            }
            onGuard={(value) =>
              patchVerge({ tray_proxy_groups_display_mode: value })
            }
          >
            <Select>
              <SelectTrigger size="sm" className="w-auto min-w-36 max-w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  {t(
                    'settings.components.verge.layout.options.proxyGroupsDisplayMode.default',
                  )}
                </SelectItem>
                <SelectItem value="inline">
                  {t(
                    'settings.components.verge.layout.options.proxyGroupsDisplayMode.inline',
                  )}
                </SelectItem>
                <SelectItem value="disable">
                  {t(
                    'settings.components.verge.layout.options.proxyGroupsDisplayMode.disable',
                  )}
                </SelectItem>
              </SelectContent>
            </Select>
          </GuardState>
        </Row>

        <Row
          label={t(
            'settings.components.verge.layout.fields.showOutboundModesInline',
          )}
        >
          <GuardState
            value={verge?.tray_inline_outbound_modes ?? false}
            valueProps="checked"
            onChangeProps="onCheckedChange"
            onCatch={onError}
            onChange={(e) => onChangeData({ tray_inline_outbound_modes: e })}
            onGuard={(e) => patchVerge({ tray_inline_outbound_modes: e })}
          >
            <Switch />
          </GuardState>
        </Row>

        <Row
          label={t('settings.components.verge.layout.fields.commonTrayIcon')}
        >
          {renderIconButton(verge?.common_tray_icon, commonIcon, async () => {
            if (verge?.common_tray_icon) {
              onChangeData({ common_tray_icon: false })
              patchVerge({ common_tray_icon: false })
            } else {
              const selected = await openDialog({
                directory: false,
                multiple: false,
                filters: [
                  {
                    name: 'Tray Icon Image',
                    extensions: ['png', 'ico'],
                  },
                ],
              })

              if (selected) {
                await mutate(() => copyIconFile(`${selected}`, 'common'), {
                  id: 'copy-icon:common',
                })
                await initIconPath()
                onChangeData({ common_tray_icon: true })
                patchVerge({ common_tray_icon: true })
              }
            }
          })}
        </Row>

        <Row
          label={t(
            'settings.components.verge.layout.fields.systemProxyTrayIcon',
          )}
        >
          {renderIconButton(
            verge?.sysproxy_tray_icon,
            sysproxyIcon,
            async () => {
              if (verge?.sysproxy_tray_icon) {
                onChangeData({ sysproxy_tray_icon: false })
                patchVerge({ sysproxy_tray_icon: false })
              } else {
                const selected = await openDialog({
                  directory: false,
                  multiple: false,
                  filters: [
                    {
                      name: 'Tray Icon Image',
                      extensions: ['png', 'ico'],
                    },
                  ],
                })
                if (selected) {
                  await mutate(() => copyIconFile(`${selected}`, 'sysproxy'), {
                    id: 'copy-icon:sysproxy',
                  })
                  await initIconPath()
                  onChangeData({ sysproxy_tray_icon: true })
                  patchVerge({ sysproxy_tray_icon: true })
                }
              }
            },
          )}
        </Row>

        <Row label={t('settings.components.verge.layout.fields.tunTrayIcon')}>
          {renderIconButton(verge?.tun_tray_icon, tunIcon, async () => {
            if (verge?.tun_tray_icon) {
              onChangeData({ tun_tray_icon: false })
              patchVerge({ tun_tray_icon: false })
            } else {
              const selected = await openDialog({
                directory: false,
                multiple: false,
                filters: [
                  {
                    name: 'Tun Icon Image',
                    extensions: ['png', 'ico'],
                  },
                ],
              })
              if (selected) {
                await mutate(() => copyIconFile(`${selected}`, 'tun'), {
                  id: 'copy-icon:tun',
                })
                await initIconPath()
                onChangeData({ tun_tray_icon: true })
                patchVerge({ tun_tray_icon: true })
              }
            }
          })}
        </Row>
      </FieldGroup>
    </BaseDialog>
  )
})
