import { useLockFn } from 'ahooks'
import type { Ref } from 'react'
import { useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useVerge } from '@/hooks/use-verge'
import { entry_lightweight_mode } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { BaseDialog, type DialogRef, TooltipIcon } from '@ui/components/base'
import { Button } from '@ui/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@ui/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@ui/components/ui/input-group'
import { Switch } from '@ui/components/ui/switch'

export function LiteModeViewer({ ref }: { ref?: Ref<DialogRef> }) {
  const { t } = useTranslation()
  const { verge, patchVerge } = useVerge()

  const [open, setOpen] = useState(false)
  const [values, setValues] = useState({
    autoEnterLiteMode: false,
    autoEnterLiteModeDelay: 10,
  })

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true)
      setValues({
        autoEnterLiteMode: verge?.enable_auto_light_weight_mode ?? false,
        autoEnterLiteModeDelay: verge?.auto_light_weight_minutes ?? 10,
      })
    },
    close: () => setOpen(false),
  }))

  const onSave = useLockFn(async () => {
    try {
      await patchVerge({
        enable_auto_light_weight_mode: values.autoEnterLiteMode,
        auto_light_weight_minutes: values.autoEnterLiteModeDelay,
      })
      setOpen(false)
    } catch (err) {
      showNotice.error(err)
    }
  })

  return (
    <BaseDialog
      open={open}
      title={t('settings.modals.liteMode.title')}
      okBtn={t('shared.actions.save')}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}
    >
      <FieldGroup className="gap-3 py-1">
        <Field orientation="horizontal">
          <FieldLabel>
            {t('settings.modals.liteMode.actions.enterNow')}
          </FieldLabel>
          <Button
            variant="link"
            size="sm"
            onClick={async () =>
              await mutate(() => entry_lightweight_mode(), {
                id: 'entry-lightweight-mode',
                errorNotice: false,
              })
            }
          >
            {t('shared.actions.enable')}
          </Button>
        </Field>

        <Field orientation="horizontal">
          <div className="flex flex-1 items-center gap-1">
            <FieldLabel htmlFor="lite-mode-auto-enter">
              {t('settings.modals.liteMode.toggles.autoEnter')}
            </FieldLabel>
            <TooltipIcon
              title={t('settings.modals.liteMode.tooltips.autoEnter')}
            />
          </div>
          <Switch
            id="lite-mode-auto-enter"
            checked={values.autoEnterLiteMode}
            onCheckedChange={(c) =>
              setValues((v) => ({ ...v, autoEnterLiteMode: c }))
            }
          />
        </Field>

        {values.autoEnterLiteMode && (
          <>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="lite-mode-delay">
                {t('settings.modals.liteMode.fields.delay')}
              </FieldLabel>
              <InputGroup className="w-36">
                <InputGroupInput
                  id="lite-mode-delay"
                  autoComplete="off"
                  type="number"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  value={values.autoEnterLiteModeDelay}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      autoEnterLiteModeDelay: parseInt(e.target.value) || 1,
                    }))
                  }
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{t('shared.units.minutes')}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </Field>

            <FieldDescription className="italic">
              {t('settings.modals.liteMode.messages.autoEnterHint', {
                n: values.autoEnterLiteModeDelay,
              })}
            </FieldDescription>
          </>
        )}
      </FieldGroup>
    </BaseDialog>
  )
}
