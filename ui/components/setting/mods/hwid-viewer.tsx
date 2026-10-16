import { useLockFn } from 'ahooks'
import { CopyIcon } from 'lucide-react'
import type { Ref } from 'react'
import { useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useVerge } from '@/hooks/use-verge'
import { getDeviceHwid } from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import { useQuery } from '@/services/query-client'
import { BaseDialog, type DialogRef } from '@ui/components/base'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/ui/input-group'
import { Switch } from '@ui/components/ui/switch'

const HWID_PATTERN = /^[A-Za-z0-9=-]{10,64}$/

const useDeviceHwid = () => {
  const { data } = useQuery({
    queryKey: ['getDeviceHwid'],
    queryFn: getDeviceHwid,
    staleTime: Infinity,
  })

  return data ?? ''
}

export function HwidViewer({ ref }: { ref?: Ref<DialogRef> }) {
  const { t } = useTranslation()
  const { verge, patchVerge } = useVerge()
  const deviceHwid = useDeviceHwid()

  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [customHwid, setCustomHwid] = useState('')

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true)
      setEnabled(verge?.enable_send_hwid ?? false)
      setCustomHwid(verge?.custom_hwid ?? '')
    },
    close: () => setOpen(false),
  }))

  const trimmedHwid = customHwid.trim()
  const invalid = !!trimmedHwid && !HWID_PATTERN.test(trimmedHwid)

  const onCopy = useLockFn(async () => {
    const value = trimmedHwid || deviceHwid
    if (!value) return
    await navigator.clipboard.writeText(value)
    showNotice.success('settings.sections.hwid.messages.hwidCopied')
  })

  const onSave = useLockFn(async () => {
    if (invalid) {
      showNotice.error('settings.sections.hwid.messages.invalidHwid')
      return
    }
    try {
      await patchVerge({
        enable_send_hwid: enabled,
        custom_hwid: trimmedHwid,
      })
      setOpen(false)
    } catch (err) {
      showNotice.error(err)
    }
  })

  return (
    <BaseDialog
      open={open}
      title={t('settings.sections.hwid.title')}
      description={t('settings.sections.hwid.tooltips.sendHwid')}
      okBtn={t('shared.actions.save')}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}
    >
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="send-hwid">
            {t('settings.sections.hwid.fields.sendHwid')}
          </FieldLabel>
          <Switch
            id="send-hwid"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="device-hwid">
            {t('settings.sections.hwid.fields.deviceHwid')}
          </FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="device-hwid"
              readOnly
              value={deviceHwid}
              className="font-mono"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={t('settings.sections.hwid.messages.hwidCopied')}
                onClick={onCopy}
              >
                <CopyIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="custom-hwid">
            {t('settings.sections.hwid.fields.customHwid')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="custom-hwid"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              placeholder={t('settings.sections.hwid.placeholders.customHwid')}
              value={customHwid}
              aria-invalid={invalid}
              onChange={(e) => setCustomHwid(e.target.value)}
            />
            {invalid ? (
              <FieldError>
                {t('settings.sections.hwid.messages.invalidHwid')}
              </FieldError>
            ) : (
              <FieldDescription>
                {t('settings.sections.hwid.tooltips.customHwid')}
              </FieldDescription>
            )}
            <FieldDescription>
              {t('settings.sections.hwid.tooltips.sharedDevice')}
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>
    </BaseDialog>
  )
}
