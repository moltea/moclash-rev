import { useLockFn } from 'ahooks'
import { nanoid } from 'nanoid'
import { forwardRef, useId, useImperativeHandle, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useVerge } from '@/hooks/use-verge'
import { showNotice } from '@/services/notice-service'
import { BaseDialog } from '@ui/components/base'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'
import { Textarea } from '@ui/components/ui/textarea'

interface Props {
  onChange: (uid: string, patch?: Partial<IVergeTestItem>) => void
}

export interface TestViewerRef {
  create: () => void
  edit: (item: IVergeTestItem) => void
}

export const TestViewer = forwardRef<TestViewerRef, Props>(
  ({ onChange }, ref) => {
    const { t } = useTranslation()
    const id = useId()
    const [open, setOpen] = useState(false)
    const [openType, setOpenType] = useState<'new' | 'edit'>('new')
    const [loading, setLoading] = useState(false)
    const { verge, patchVerge } = useVerge()
    const testList = verge?.test_list ?? []
    const { control, ...formIns } = useForm<IVergeTestItem>({
      defaultValues: {
        name: '',
        icon: '',
        url: '',
      },
    })

    const patchTestList = async (
      uid: string,
      patch: Partial<IVergeTestItem>,
    ) => {
      const newList = testList.map((x) => {
        if (x.uid === uid) {
          return { ...x, ...patch }
        }
        return x
      })
      await patchVerge({ test_list: newList })
    }

    useImperativeHandle(ref, () => ({
      create: () => {
        setOpenType('new')
        setOpen(true)
      },
      edit: (item) => {
        if (item) {
          Object.entries(item).forEach(([key, value]) => {
            formIns.setValue(key as any, value)
          })
        }
        setOpenType('edit')
        setOpen(true)
      },
    }))

    const handleOk = useLockFn(
      formIns.handleSubmit(async (form) => {
        setLoading(true)
        try {
          if (!form.name) {
            throw new Error(t('tests.modals.test.errors.nameRequired'))
          }
          if (!form.url) {
            throw new Error(t('tests.modals.test.errors.urlRequired'))
          }

          if (openType === 'new') {
            const uid = nanoid()
            const item = { ...form, uid }
            const newList = [...testList, item]
            await patchVerge({ test_list: newList })
            onChange(uid)
          } else {
            if (!form.uid) {
              throw new Error(t('tests.modals.test.errors.uidMissing'))
            }
            const uid = form.uid

            await patchTestList(uid, form)
            onChange(uid, form)
          }
          setOpen(false)
          setLoading(false)
          setTimeout(() => formIns.reset(), 500)
        } catch (err: any) {
          showNotice.error('tests.modals.test.errors.saveFailed', err)
          setLoading(false)
        }
      }),
    )

    const handleClose = () => {
      setOpen(false)
      setTimeout(() => formIns.reset(), 500)
    }

    const text = {
      autoComplete: 'off',
      autoCorrect: 'off',
    } as const

    return (
      <BaseDialog
        open={open}
        title={
          openType === 'new'
            ? t('tests.modals.test.title.create')
            : t('tests.modals.test.title.edit')
        }
        className="sm:max-w-sm"
        okBtn={t('shared.actions.save')}
        cancelBtn={t('shared.actions.cancel')}
        onClose={handleClose}
        onCancel={handleClose}
        onOk={handleOk}
        loading={loading}
      >
        <FieldGroup className="py-1">
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={`${id}-name`}>
                  {t('shared.labels.name')}
                </FieldLabel>
                <Input
                  {...text}
                  {...field}
                  value={field.value ?? ''}
                  id={`${id}-name`}
                />
              </Field>
            )}
          />
          <Controller
            name="icon"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={`${id}-icon`}>
                  {t('shared.labels.icon')}
                </FieldLabel>
                <Textarea
                  {...text}
                  {...field}
                  value={field.value ?? ''}
                  id={`${id}-icon`}
                  rows={1}
                  className="max-h-28 min-h-7 overflow-y-auto py-1 break-all"
                />
              </Field>
            )}
          />
          <Controller
            name="url"
            control={control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={`${id}-url`}>
                  {t('tests.modals.test.fields.url')}
                </FieldLabel>
                <Textarea
                  {...text}
                  {...field}
                  value={field.value ?? ''}
                  id={`${id}-url`}
                  rows={1}
                  className="max-h-18 min-h-7 overflow-y-auto py-1 break-all"
                />
              </Field>
            )}
          />
        </FieldGroup>
      </BaseDialog>
    )
  },
)
