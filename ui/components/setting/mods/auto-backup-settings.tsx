import { useLockFn } from 'ahooks'
import { type ChangeEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useVerge } from '@/hooks/use-verge'
import { showNotice } from '@/services/notice-service'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@ui/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@ui/components/ui/input-group'
import { Switch } from '@ui/components/ui/switch'

const MIN_INTERVAL_HOURS = 1
const MAX_INTERVAL_HOURS = 168

interface AutoBackupState {
  scheduleEnabled: boolean
  intervalHours: number
  changeEnabled: boolean
}

export function AutoBackupSettings() {
  const { t } = useTranslation()
  const { verge, patchVerge } = useVerge()
  const derivedValues = useMemo<AutoBackupState>(() => {
    return {
      scheduleEnabled: verge?.enable_auto_backup_schedule ?? false,
      intervalHours: verge?.auto_backup_interval_hours ?? 24,
      changeEnabled: verge?.auto_backup_on_change ?? true,
    }
  }, [
    verge?.enable_auto_backup_schedule,
    verge?.auto_backup_interval_hours,
    verge?.auto_backup_on_change,
  ])
  const [pendingValues, setPendingValues] = useState<AutoBackupState | null>(
    null,
  )
  const values = useMemo(() => {
    if (!pendingValues) {
      return derivedValues
    }
    if (
      pendingValues.scheduleEnabled === derivedValues.scheduleEnabled &&
      pendingValues.intervalHours === derivedValues.intervalHours &&
      pendingValues.changeEnabled === derivedValues.changeEnabled
    ) {
      return derivedValues
    }
    return pendingValues
  }, [pendingValues, derivedValues])
  const [intervalInputDraft, setIntervalInputDraft] = useState<string | null>(
    null,
  )

  const applyPatch = useLockFn(
    async (
      partial: Partial<AutoBackupState>,
      payload: Partial<IVergeConfig>,
    ) => {
      const nextValues = { ...values, ...partial }
      setPendingValues(nextValues)
      try {
        await patchVerge(payload)
      } catch (error) {
        showNotice.error(error)
        setPendingValues(null)
      }
    },
  )

  const disabled = !verge

  const handleScheduleToggle = (checked: boolean) => {
    applyPatch(
      { scheduleEnabled: checked },
      {
        enable_auto_backup_schedule: checked,
        auto_backup_interval_hours: values.intervalHours,
      },
    )
  }

  const handleChangeToggle = (checked: boolean) => {
    applyPatch({ changeEnabled: checked }, { auto_backup_on_change: checked })
  }

  const handleIntervalInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setIntervalInputDraft(event.target.value)
  }

  const commitIntervalInput = () => {
    const rawValue = intervalInputDraft ?? values.intervalHours.toString()
    const trimmed = rawValue.trim()
    if (trimmed === '') {
      setIntervalInputDraft(null)
      return
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      setIntervalInputDraft(null)
      return
    }

    const clamped = Math.min(
      MAX_INTERVAL_HOURS,
      Math.max(MIN_INTERVAL_HOURS, Math.round(parsed)),
    )

    if (clamped === values.intervalHours) {
      setIntervalInputDraft(null)
      return
    }

    applyPatch(
      { intervalHours: clamped },
      { auto_backup_interval_hours: clamped },
    )
    setIntervalInputDraft(null)
  }

  const scheduleDisabled = disabled || !values.scheduleEnabled

  return (
    <FieldGroup className="gap-3">
      <Field orientation="horizontal" data-disabled={disabled}>
        <FieldContent>
          <FieldLabel htmlFor="auto-backup-schedule">
            {t('settings.modals.backup.auto.scheduleLabel')}
          </FieldLabel>
          <FieldDescription>
            {t('settings.modals.backup.auto.scheduleHelper')}
          </FieldDescription>
        </FieldContent>
        <Switch
          id="auto-backup-schedule"
          checked={values.scheduleEnabled}
          onCheckedChange={handleScheduleToggle}
          disabled={disabled}
        />
      </Field>

      <FieldSeparator />

      <Field orientation="horizontal" data-disabled={scheduleDisabled}>
        <FieldLabel htmlFor="auto-backup-interval">
          {t('settings.modals.backup.auto.intervalLabel')}
        </FieldLabel>
        <InputGroup className="w-40" data-disabled={scheduleDisabled}>
          <InputGroupInput
            id="auto-backup-interval"
            type="number"
            inputMode="numeric"
            min={MIN_INTERVAL_HOURS}
            max={MAX_INTERVAL_HOURS}
            value={intervalInputDraft ?? values.intervalHours.toString()}
            disabled={scheduleDisabled}
            onChange={handleIntervalInputChange}
            onBlur={commitIntervalInput}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitIntervalInput()
              }
            }}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{t('shared.units.hours')}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </Field>

      <FieldSeparator />

      <Field orientation="horizontal" data-disabled={disabled}>
        <FieldContent>
          <FieldLabel htmlFor="auto-backup-change">
            {t('settings.modals.backup.auto.changeLabel')}
          </FieldLabel>
          <FieldDescription>
            {t('settings.modals.backup.auto.changeHelper')}
          </FieldDescription>
        </FieldContent>
        <Switch
          id="auto-backup-change"
          checked={values.changeEnabled}
          onCheckedChange={handleChangeToggle}
          disabled={disabled}
        />
      </Field>
    </FieldGroup>
  )
}
