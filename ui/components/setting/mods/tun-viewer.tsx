import { useLockFn } from 'ahooks'
import { RotateCcwIcon } from 'lucide-react'
import type { Ref } from 'react'
import { useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useClash } from '@/hooks/use-clash'
import { enhanceProfiles } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import getSystem from '@/utils/get-system'
import { areValidIpCidrs } from '@/utils/network'
import {
  BaseDialog,
  BaseSplitChipEditor,
  type DialogRef,
  TooltipIcon,
} from '@ui/components/base'
import { Button } from '@ui/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'
import { Switch } from '@ui/components/ui/switch'
import { cn } from '@ui/lib/utils'

import { StackModeSwitch } from './stack-mode-switch'

const OS = getSystem()

const splitRouteExcludeAddress = (value: string) =>
  value
    .split(/[,\n;\r]+/)
    .map((item) => item.trim())
    .filter(Boolean)

export function TunViewer({ ref }: { ref?: Ref<DialogRef> }) {
  const { t } = useTranslation()

  const { clash, mutateClash, patchClash } = useClash()

  const [open, setOpen] = useState(false)
  const [values, setValues] = useState({
    stack: 'mips',
    device: OS === 'macos' ? 'utun1024' : 'Mihomo',
    autoRoute: true,
    routeExcludeAddress: '',
    autoRedirect: false,
    autoDetectInterface: true,
    dnsHijack: ['any:53'],
    strictRoute: false,
    mtu: 1500,
  })

  const routeExcludeAddressItems = splitRouteExcludeAddress(
    values.routeExcludeAddress,
  )
  const routeExcludeAddressError =
    values.autoRoute &&
    routeExcludeAddressItems.length > 0 &&
    !areValidIpCidrs(routeExcludeAddressItems)
  const routeExcludeAddressHelperText = routeExcludeAddressError
    ? t('settings.modals.tun.messages.invalidRouteExcludeAddress')
    : t('settings.modals.tun.messages.routeExcludeAddressHint')

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true)
      const nextAutoRoute = clash?.tun['auto-route'] ?? true
      const rawAutoRedirect = clash?.tun['auto-redirect'] ?? false
      const computedAutoRedirect =
        OS === 'linux' ? (nextAutoRoute ? rawAutoRedirect : false) : false
      setValues({
        stack: clash?.tun.stack ?? 'mips',
        device: clash?.tun.device ?? (OS === 'macos' ? 'utun1024' : 'Mihomo'),
        autoRoute: nextAutoRoute,
        routeExcludeAddress: (clash?.tun['route-exclude-address'] ?? []).join(
          ',',
        ),
        autoRedirect: computedAutoRedirect,
        autoDetectInterface: clash?.tun['auto-detect-interface'] ?? true,
        dnsHijack: clash?.tun['dns-hijack'] ?? ['any:53'],
        strictRoute: clash?.tun['strict-route'] ?? false,
        mtu: clash?.tun.mtu ?? 1500,
      })
    },
    close: () => setOpen(false),
  }))

  const onSave = useLockFn(async () => {
    try {
      const routeExcludeAddress = routeExcludeAddressItems

      if (routeExcludeAddressError) {
        showNotice.error(
          'settings.modals.tun.messages.invalidRouteExcludeAddress',
        )
        return
      }

      const tun: IConfigData['tun'] = {
        stack: values.stack,
        device:
          values.device === ''
            ? OS === 'macos'
              ? 'utun1024'
              : 'Mihomo'
            : values.device,
        'auto-route': values.autoRoute,
        'route-exclude-address': routeExcludeAddress,
        ...(OS === 'linux'
          ? {
              'auto-redirect': values.autoRedirect,
            }
          : {}),
        'auto-detect-interface': values.autoDetectInterface,
        'dns-hijack': values.dnsHijack[0] === '' ? [] : values.dnsHijack,
        'strict-route': values.strictRoute,
        mtu: values.mtu ?? 1500,
      }
      await patchClash({ tun })
      await mutateClash(
        (old) => ({
          ...old!,
          tun,
        }),
        false,
      )
      setOpen(false)
      showNotice.success('settings.modals.tun.messages.applied')
      void mutate(() => enhanceProfiles(), {
        id: 'enhance-profiles',
        errorNotice: false,
      }).catch((err: any) => {
        showNotice.error(err)
      })
    } catch (err: any) {
      showNotice.error(err)
    }
  })

  const onResetToDefault = async () => {
    const tun: IConfigData['tun'] = {
      stack: 'mips',
      device: OS === 'macos' ? 'utun1024' : 'Mihomo',
      'auto-route': true,
      ...(OS === 'linux'
        ? {
            'auto-redirect': false,
          }
        : {}),
      'auto-detect-interface': true,
      'dns-hijack': ['any:53'],
      'route-exclude-address': [],
      'strict-route': false,
      mtu: 1500,
    }
    setValues({
      stack: 'mips',
      device: OS === 'macos' ? 'utun1024' : 'Mihomo',
      autoRoute: true,
      routeExcludeAddress: '',
      autoRedirect: false,
      autoDetectInterface: true,
      dnsHijack: ['any:53'],
      strictRoute: false,
      mtu: 1500,
    })
    await patchClash({ tun })
    await mutateClash(
      (old) => ({
        ...old!,
        tun,
      }),
      false,
    )
  }

  return (
    <BaseDialog
      open={open}
      title={
        <div className="flex items-center justify-between gap-2 pe-6">
          {t('settings.modals.tun.title')}
          <Button variant="outline" size="sm" onClick={onResetToDefault}>
            <RotateCcwIcon data-icon="inline-start" />
            {t('shared.actions.resetToDefault')}
          </Button>
        </div>
      }
      className="sm:max-w-lg"
      okBtn={t('shared.actions.save')}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}
    >
      <FieldGroup className="gap-3 py-1">
        <Field orientation="horizontal">
          <FieldLabel>{t('settings.modals.tun.fields.stack')}</FieldLabel>
          <StackModeSwitch
            value={values.stack}
            onChange={(value) => {
              setValues((v) => ({
                ...v,
                stack: value,
              }))
            }}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="tun-device">
            {t('settings.modals.tun.fields.device')}
          </FieldLabel>
          <Input
            id="tun-device"
            className="w-56"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={values.device}
            placeholder="Mihomo"
            onChange={(e) =>
              setValues((v) => ({ ...v, device: e.target.value }))
            }
          />
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="tun-auto-route">
            {t('settings.modals.tun.fields.autoRoute')}
          </FieldLabel>
          <Switch
            id="tun-auto-route"
            checked={values.autoRoute}
            onCheckedChange={(c) =>
              setValues((v) => ({
                ...v,
                autoRoute: c,
                autoRedirect: c ? v.autoRedirect : false,
              }))
            }
          />
        </Field>

        {OS === 'linux' && (
          <Field orientation="horizontal" data-disabled={!values.autoRoute}>
            <div className="flex flex-1 items-center gap-1">
              <FieldLabel htmlFor="tun-auto-redirect">
                {t('settings.modals.tun.fields.autoRedirect')}
              </FieldLabel>
              <TooltipIcon
                title={t('settings.modals.tun.tooltips.autoRedirect')}
                className={cn(!values.autoRoute && 'opacity-50')}
              />
            </div>
            <Switch
              id="tun-auto-redirect"
              checked={values.autoRedirect}
              onCheckedChange={(c) =>
                setValues((v) => ({
                  ...v,
                  autoRedirect: v.autoRoute ? c : v.autoRedirect,
                }))
              }
              disabled={!values.autoRoute}
            />
          </Field>
        )}

        <Field orientation="horizontal">
          <FieldLabel htmlFor="tun-strict-route">
            {t('settings.modals.tun.fields.strictRoute')}
          </FieldLabel>
          <Switch
            id="tun-strict-route"
            checked={values.strictRoute}
            onCheckedChange={(c) =>
              setValues((v) => ({ ...v, strictRoute: c }))
            }
          />
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="tun-auto-detect-interface">
            {t('settings.modals.tun.fields.autoDetectInterface')}
          </FieldLabel>
          <Switch
            id="tun-auto-detect-interface"
            checked={values.autoDetectInterface}
            onCheckedChange={(c) =>
              setValues((v) => ({ ...v, autoDetectInterface: c }))
            }
          />
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="tun-dns-hijack">
            {t('settings.modals.tun.fields.dnsHijack')}
          </FieldLabel>
          <Input
            id="tun-dns-hijack"
            className="w-56"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={values.dnsHijack.join(',')}
            placeholder={t('settings.modals.tun.tooltips.dnsHijack')}
            onChange={(e) =>
              setValues((v) => ({ ...v, dnsHijack: e.target.value.split(',') }))
            }
          />
        </Field>

        <Field orientation="horizontal">
          <FieldLabel htmlFor="tun-mtu">
            {t('settings.modals.tun.fields.mtu')}
          </FieldLabel>
          <Input
            id="tun-mtu"
            className="w-56"
            type="number"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={values.mtu}
            placeholder="1500"
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                mtu: parseInt(e.target.value),
              }))
            }
          />
        </Field>

        <BaseSplitChipEditor
          value={values.routeExcludeAddress}
          placeholder="192.168.0.0/16"
          ariaLabel={t('settings.modals.tun.fields.routeExcludeAddress')}
          disabled={!values.autoRoute}
          error={routeExcludeAddressError}
          helperText={routeExcludeAddressHelperText}
          onChange={(nextValue) =>
            setValues((v) => ({ ...v, routeExcludeAddress: nextValue }))
          }
          renderHeader={(modeToggle) => (
            <Field orientation="horizontal">
              <FieldLabel>
                {t('settings.modals.tun.fields.routeExcludeAddress')}
              </FieldLabel>
              {modeToggle}
            </Field>
          )}
        />
      </FieldGroup>
    </BaseDialog>
  )
}
