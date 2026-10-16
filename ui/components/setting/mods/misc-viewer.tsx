import { useLockFn } from 'ahooks'
import {
  forwardRef,
  type ReactNode,
  useImperativeHandle,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useVerge } from '@/hooks/use-verge'
import { showNotice } from '@/services/notice-service'
import { BaseDialog, type DialogRef, TooltipIcon } from '@ui/components/base'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'
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

const Row = ({
  id,
  label,
  tip,
  children,
}: {
  id?: string
  label: string
  tip?: string
  children: ReactNode
}) => (
  <Field orientation="horizontal">
    <div className="flex flex-1 items-center gap-1">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {tip && <TooltipIcon title={tip} />}
    </div>
    {children}
  </Field>
)

export const MiscViewer = forwardRef<DialogRef>((props, ref) => {
  const { t } = useTranslation()
  const { verge, patchVerge } = useVerge()

  const [open, setOpen] = useState(false)
  const [values, setValues] = useState({
    appLogLevel: 'warn',
    appLogMaxSize: 8,
    appLogMaxCount: 12,
    autoCloseConnection: true,
    autoCheckUpdate: true,
    enableBuiltinEnhanced: true,
    proxyLayoutColumn: 6,
    enableAutoDelayDetection: false,
    autoDelayDetectionIntervalMinutes: 5,
    defaultLatencyTest: '',
    autoLogClean: 2,
    defaultLatencyTimeout: 10000,
  })

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true)
      setValues({
        appLogLevel: verge?.app_log_level ?? 'warn',
        appLogMaxSize: verge?.app_log_max_size ?? 128,
        appLogMaxCount: verge?.app_log_max_count ?? 8,
        autoCloseConnection: verge?.auto_close_connection ?? true,
        autoCheckUpdate: verge?.auto_check_update ?? true,
        enableBuiltinEnhanced: verge?.enable_builtin_enhanced ?? true,
        proxyLayoutColumn: verge?.proxy_layout_column || 6,
        enableAutoDelayDetection: verge?.enable_auto_delay_detection ?? false,
        autoDelayDetectionIntervalMinutes:
          verge?.auto_delay_detection_interval_minutes ?? 5,
        defaultLatencyTest: verge?.default_latency_test || '',
        autoLogClean: verge?.auto_log_clean || 0,
        defaultLatencyTimeout: verge?.default_latency_timeout || 10000,
      })
    },
    close: () => setOpen(false),
  }))

  const onSave = useLockFn(async () => {
    try {
      await patchVerge({
        app_log_level: values.appLogLevel,
        app_log_max_size: values.appLogMaxSize,
        app_log_max_count: values.appLogMaxCount,
        auto_close_connection: values.autoCloseConnection,
        auto_check_update: values.autoCheckUpdate,
        enable_builtin_enhanced: values.enableBuiltinEnhanced,
        proxy_layout_column: values.proxyLayoutColumn,
        enable_auto_delay_detection: values.enableAutoDelayDetection,
        auto_delay_detection_interval_minutes:
          values.autoDelayDetectionIntervalMinutes,
        default_latency_test: values.defaultLatencyTest,
        default_latency_timeout: values.defaultLatencyTimeout,
        auto_log_clean: values.autoLogClean as any,
      })
      setOpen(false)
    } catch (err) {
      showNotice.error(err)
    }
  })

  return (
    <BaseDialog
      open={open}
      title={t('settings.modals.misc.title')}
      className="sm:max-w-lg"
      okBtn={t('shared.actions.save')}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}
    >
      <FieldGroup className="gap-3 py-1">
        <Row label={t('settings.modals.misc.fields.appLogLevel')}>
          <Select
            value={values.appLogLevel}
            onValueChange={(value) =>
              setValues((v) => ({
                ...v,
                appLogLevel: value,
              }))
            }
          >
            <SelectTrigger size="sm" className="w-auto min-w-24 max-w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['trace', 'debug', 'info', 'warn', 'error', 'silent'].map(
                (i) => (
                  <SelectItem value={i} key={i}>
                    {i[0].toUpperCase() + i.slice(1).toLowerCase()}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </Row>

        <Row
          id="misc-app-log-max-size"
          label={t('settings.modals.misc.fields.appLogMaxSize')}
        >
          <InputGroup className="w-36">
            <InputGroupInput
              id="misc-app-log-max-size"
              autoComplete="new-password"
              type="number"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              value={values.appLogMaxSize}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  appLogMaxSize: Math.max(1, parseInt(e.target.value) || 128),
                }))
              }
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>{t('shared.units.kilobytes')}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Row>

        <Row
          id="misc-app-log-max-count"
          label={t('settings.modals.misc.fields.appLogMaxCount')}
        >
          <InputGroup className="w-36">
            <InputGroupInput
              id="misc-app-log-max-count"
              autoComplete="new-password"
              type="number"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              value={values.appLogMaxCount}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  appLogMaxCount: Math.max(1, parseInt(e.target.value) || 1),
                }))
              }
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>{t('shared.units.files')}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Row>

        <Row
          id="misc-auto-close-connection"
          label={t('settings.modals.misc.fields.autoCloseConnections')}
          tip={t('settings.modals.misc.tooltips.autoCloseConnections')}
        >
          <Switch
            id="misc-auto-close-connection"
            checked={values.autoCloseConnection}
            onCheckedChange={(c) =>
              setValues((v) => ({ ...v, autoCloseConnection: c }))
            }
          />
        </Row>

        <Row
          id="misc-auto-check-update"
          label={t('settings.modals.misc.fields.autoCheckUpdate')}
        >
          <Switch
            id="misc-auto-check-update"
            checked={values.autoCheckUpdate}
            onCheckedChange={(c) =>
              setValues((v) => ({ ...v, autoCheckUpdate: c }))
            }
          />
        </Row>

        <Row
          id="misc-enable-builtin-enhanced"
          label={t('settings.modals.misc.fields.enableBuiltinEnhanced')}
          tip={t('settings.modals.misc.tooltips.enableBuiltinEnhanced')}
        >
          <Switch
            id="misc-enable-builtin-enhanced"
            checked={values.enableBuiltinEnhanced}
            onCheckedChange={(c) =>
              setValues((v) => ({ ...v, enableBuiltinEnhanced: c }))
            }
          />
        </Row>

        <Row label={t('settings.modals.misc.fields.proxyLayoutColumns')}>
          <Select
            value={String(values.proxyLayoutColumn)}
            onValueChange={(value) =>
              setValues((v) => ({
                ...v,
                proxyLayoutColumn: Number(value),
              }))
            }
          >
            <SelectTrigger size="sm" className="w-auto min-w-40 max-w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">
                {t('settings.modals.misc.options.proxyLayoutColumns.auto')}
              </SelectItem>
              {[1, 2, 3, 4, 5].map((i) => (
                <SelectItem value={String(i)} key={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row label={t('settings.modals.misc.fields.autoLogClean')}>
          <Select
            value={String(values.autoLogClean)}
            onValueChange={(value) =>
              setValues((v) => ({
                ...v,
                autoLogClean: Number(value),
              }))
            }
          >
            <SelectTrigger size="sm" className="w-auto min-w-40 max-w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                {
                  key: t('settings.modals.misc.options.autoLogClean.never'),
                  value: 0,
                },
                {
                  key: t(
                    'settings.modals.misc.options.autoLogClean.retainDays',
                    { n: 1 },
                  ),
                  value: 1,
                },
                {
                  key: t(
                    'settings.modals.misc.options.autoLogClean.retainDays',
                    { n: 7 },
                  ),
                  value: 2,
                },
                {
                  key: t(
                    'settings.modals.misc.options.autoLogClean.retainDays',
                    { n: 30 },
                  ),
                  value: 3,
                },
                {
                  key: t(
                    'settings.modals.misc.options.autoLogClean.retainDays',
                    { n: 90 },
                  ),
                  value: 4,
                },
              ].map((i) => (
                <SelectItem key={i.value} value={String(i.value)}>
                  {i.key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>

        <Row
          id="misc-auto-delay-detection"
          label={t('settings.modals.misc.fields.autoDelayDetection')}
          tip={t('settings.modals.misc.tooltips.autoDelayDetection')}
        >
          <Switch
            id="misc-auto-delay-detection"
            checked={values.enableAutoDelayDetection}
            onCheckedChange={(c) =>
              setValues((v) => ({ ...v, enableAutoDelayDetection: c }))
            }
          />
        </Row>

        <Row
          id="misc-auto-delay-detection-interval"
          label={t('settings.modals.misc.fields.autoDelayDetectionInterval')}
        >
          <InputGroup
            className="w-40"
            data-disabled={!values.enableAutoDelayDetection}
          >
            <InputGroupInput
              id="misc-auto-delay-detection-interval"
              autoComplete="new-password"
              type="number"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              value={values.autoDelayDetectionIntervalMinutes}
              disabled={!values.enableAutoDelayDetection}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10)
                const intervalMinutes =
                  Number.isFinite(parsed) && parsed > 0 ? parsed : 1
                setValues((v) => ({
                  ...v,
                  autoDelayDetectionIntervalMinutes: intervalMinutes,
                }))
              }}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>{t('shared.units.minutes')}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Row>

        <Row
          id="misc-default-latency-test"
          label={t('settings.modals.misc.fields.defaultLatencyTest')}
          tip={t('settings.modals.misc.tooltips.defaultLatencyTest')}
        >
          <Input
            id="misc-default-latency-test"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            className="w-60"
            value={values.defaultLatencyTest}
            placeholder="http://cp.cloudflare.com/generate_204"
            onChange={(e) =>
              setValues((v) => ({ ...v, defaultLatencyTest: e.target.value }))
            }
          />
        </Row>

        <Row
          id="misc-default-latency-timeout"
          label={t('settings.modals.misc.fields.defaultLatencyTimeout')}
        >
          <InputGroup className="w-60">
            <InputGroupInput
              id="misc-default-latency-timeout"
              autoComplete="new-password"
              type="number"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              value={values.defaultLatencyTimeout}
              placeholder="10000"
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  defaultLatencyTimeout: parseInt(e.target.value),
                }))
              }
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>{t('shared.units.milliseconds')}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </Row>
      </FieldGroup>
    </BaseDialog>
  )
})
