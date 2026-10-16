import { useLockFn } from 'ahooks'
import { CopyIcon } from 'lucide-react'
import { type Ref, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useClashInfo } from '@/hooks/use-clash'
import { useVerge } from '@/hooks/use-verge'
import { showNotice } from '@/services/notice-service'
import { BaseDialog, type DialogRef } from '@ui/components/base'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/ui/input-group'
import { Switch } from '@ui/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'

export function ControllerViewer({ ref }: { ref?: Ref<DialogRef> }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const { clashInfo, patchInfo } = useClashInfo()
  const { verge, patchVerge } = useVerge()
  const [controller, setController] = useState(clashInfo?.server || '')
  const [secret, setSecret] = useState(clashInfo?.secret || '')
  const [enableController, setEnableController] = useState(
    verge?.enable_external_controller ?? false,
  )

  useImperativeHandle(ref, () => ({
    open: async () => {
      setOpen(true)
      setController(clashInfo?.server || '')
      setSecret(clashInfo?.secret || '')
      setEnableController(verge?.enable_external_controller ?? false)
    },
    close: () => setOpen(false),
  }))

  const onSave = useLockFn(async () => {
    try {
      setIsSaving(true)

      await patchVerge({ enable_external_controller: enableController })

      if (enableController) {
        if (!controller.trim()) {
          showNotice.error(
            'settings.sections.externalController.messages.addressRequired',
          )
          return
        }

        if (!secret.trim()) {
          showNotice.error(
            'settings.sections.externalController.messages.secretRequired',
          )
          return
        }

        await patchInfo({ 'external-controller': controller, secret })
      } else {
        await patchInfo({ 'external-controller': '' })
      }

      showNotice.success('shared.feedback.notifications.common.saveSuccess')
      setOpen(false)
    } catch (err) {
      showNotice.error(
        'shared.feedback.notifications.common.saveFailed',
        err,
        4000,
      )
    } finally {
      setIsSaving(false)
    }
  })

  const handleCopyToClipboard = useLockFn(
    async (text: string, type: 'controller' | 'secret') => {
      try {
        await navigator.clipboard.writeText(text)
        showNotice.success(
          type === 'controller'
            ? 'settings.sections.externalController.messages.controllerCopied'
            : 'settings.sections.externalController.messages.secretCopied',
          2000,
        )
      } catch (err) {
        console.warn('[ControllerViewer] copy to clipboard failed:', err)
        showNotice.error(
          'settings.sections.externalController.messages.copyFailed',
        )
      }
    },
  )

  const fieldDisabled = isSaving || !enableController

  const renderCopyButton = (text: string, type: 'controller' | 'secret') => (
    <InputGroupAddon align="inline-end">
      <Tooltip>
        <TooltipTrigger asChild>
          <InputGroupButton
            size="icon-xs"
            aria-label={t('settings.sections.externalController.tooltips.copy')}
            disabled={fieldDisabled}
            onClick={() => handleCopyToClipboard(text, type)}
          >
            <CopyIcon />
          </InputGroupButton>
        </TooltipTrigger>
        <TooltipContent>
          {t('settings.sections.externalController.tooltips.copy')}
        </TooltipContent>
      </Tooltip>
    </InputGroupAddon>
  )

  return (
    <BaseDialog
      open={open}
      title={t('settings.sections.externalController.title')}
      className="sm:max-w-md"
      okBtn={isSaving ? t('shared.statuses.saving') : t('shared.actions.save')}
      loading={isSaving}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}
    >
      <FieldGroup className="gap-3 py-1">
        <Field orientation="horizontal" data-disabled={isSaving}>
          <FieldLabel htmlFor="external-controller-enable">
            {t('settings.sections.externalController.fields.enable')}
          </FieldLabel>
          <Switch
            id="external-controller-enable"
            checked={enableController}
            onCheckedChange={setEnableController}
            disabled={isSaving}
          />
        </Field>

        <Field orientation="horizontal" data-disabled={fieldDisabled}>
          <FieldLabel htmlFor="external-controller-address">
            {t('settings.sections.externalController.fields.address')}
          </FieldLabel>
          <InputGroup className="w-52" data-disabled={fieldDisabled}>
            <InputGroupInput
              id="external-controller-address"
              value={controller}
              placeholder={t(
                'settings.sections.externalController.placeholders.address',
              )}
              onChange={(e) => setController(e.target.value)}
              disabled={fieldDisabled}
            />
            {renderCopyButton(controller, 'controller')}
          </InputGroup>
        </Field>

        <Field orientation="horizontal" data-disabled={fieldDisabled}>
          <FieldLabel htmlFor="external-controller-secret">
            {t('settings.sections.externalController.fields.secret')}
          </FieldLabel>
          <InputGroup className="w-52" data-disabled={fieldDisabled}>
            <InputGroupInput
              id="external-controller-secret"
              value={secret}
              placeholder={t(
                'settings.sections.externalController.placeholders.secret',
              )}
              onChange={(e) => setSecret(e.target.value)}
              disabled={fieldDisabled}
            />
            {renderCopyButton(secret, 'secret')}
          </InputGroup>
        </Field>
      </FieldGroup>
    </BaseDialog>
  )
}
