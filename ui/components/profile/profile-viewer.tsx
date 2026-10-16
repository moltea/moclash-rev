import { useLockFn } from 'ahooks'
import type { ReactNode, Ref } from 'react'
import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useProfiles } from '@/hooks/use-profiles'
import { createProfile, patchProfile } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { version } from '@root/package.json'
import { BaseDialog } from '@ui/components/base'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@ui/components/ui/field'
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
import { Textarea } from '@ui/components/ui/textarea'

import { FileInput } from './file-input'

const SwitchField = ({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string
  label: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) => (
  <Field orientation="horizontal">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
  </Field>
)

interface Props {
  onChange: (isActivating?: boolean) => void
}

export interface ProfileViewerRef {
  create: () => void
  edit: (item: IProfileItem) => void
}

type ProfileViewerProps = Props & { ref?: Ref<ProfileViewerRef> }

const MIN_UPDATE_INTERVAL = 1440
const HAPP_USER_AGENT = 'Happ/4.5.4'
const DEFAULT_USER_AGENT = `clash-verge/v${version}`

export function ProfileViewer({ onChange, ref }: ProfileViewerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [openType, setOpenType] = useState<'new' | 'edit'>('new')
  const [loading, setLoading] = useState(false)
  const { profiles } = useProfiles()

  const fileDataRef = useRef<string | null>(null)

  const { control, watch, setValue, reset, handleSubmit, getValues } =
    useForm<IProfileItem>({
      defaultValues: {
        type: 'remote',
        name: '',
        desc: '',
        url: '',
        option: {
          with_proxy: false,
          self_proxy: false,
          allow_auto_update: true,
        },
      },
    })

  useImperativeHandle(ref, () => ({
    create: () => {
      setOpenType('new')
      setOpen(true)
    },
    edit: (item: IProfileItem) => {
      if (item) {
        Object.entries(item).forEach(([key, value]) => {
          setValue(key as any, value)
        })
      }
      setOpenType('edit')
      setOpen(true)
    },
  }))

  const selfProxy = watch('option.self_proxy')
  const withProxy = watch('option.with_proxy')
  const happCompat = watch('option.happ_compat')

  const handleHappCompatChange = (checked: boolean) => {
    const userAgent = getValues('option.user_agent') ?? ''
    if (checked && (!userAgent || userAgent === DEFAULT_USER_AGENT)) {
      setValue('option.user_agent', HAPP_USER_AGENT)
    } else if (!checked && userAgent === HAPP_USER_AGENT) {
      setValue('option.user_agent', '')
    }
  }

  useEffect(() => {
    if (selfProxy) setValue('option.with_proxy', false)
  }, [selfProxy, setValue])

  useEffect(() => {
    if (withProxy) setValue('option.self_proxy', false)
  }, [setValue, withProxy])

  const handleOk = useLockFn(
    handleSubmit(async (form) => {
      setLoading(true)
      try {
        if (!form.type) {
          throw new Error(t('profiles.modals.profileForm.errors.typeRequired'))
        }
        if (form.type === 'remote' && !form.url) {
          throw new Error(t('profiles.modals.profileForm.errors.urlRequired'))
        }

        const option = form.option ? { ...form.option } : undefined
        if (option?.timeout_seconds) {
          option.timeout_seconds = +option.timeout_seconds
        } else if (option) {
          option.timeout_seconds = undefined
        }
        if (option?.update_interval) {
          option.update_interval = +option.update_interval
        } else if (option) {
          option.update_interval = undefined
        }
        if (option?.user_agent === '') {
          option.user_agent = undefined
        }

        const name = form.name || `${form.type} file`
        const item = {
          type: form.type,
          name,
          desc: form.desc,
          option,
          ...(form.type === 'remote' ? { url: form.url } : {}),
        }
        const isRemote = form.type === 'remote'
        const isUpdate = openType === 'edit'

        const isActivating = isUpdate && form.uid === (profiles?.current ?? '')

        const originalOptions = {
          with_proxy: form.option?.with_proxy,
          self_proxy: form.option?.self_proxy,
        }

        if (!isRemote) {
          if (openType === 'new') {
            await mutate(() => createProfile(item, fileDataRef.current), {
              id: 'create-profile',
              errorNotice: false,
            })
          } else {
            if (!form.uid) {
              throw new Error(
                t('profiles.modals.profileForm.errors.uidMissing'),
              )
            }
            await mutate(() => patchProfile(form.uid!, item), {
              id: 'patch-profile',
              errorNotice: false,
            })
          }
        } else {
          try {
            if (openType === 'new') {
              await mutate(() => createProfile(item, fileDataRef.current), {
                id: 'create-profile',
                errorNotice: false,
              })
            } else {
              if (!form.uid) {
                throw new Error(
                  t('profiles.modals.profileForm.errors.uidMissing'),
                )
              }
              await mutate(() => patchProfile(form.uid!, item), {
                id: 'patch-profile',
                errorNotice: false,
              })
            }
          } catch {
            showNotice.info(
              'profiles.modals.profileForm.feedback.notifications.creationRetry',
            )

            const retryItem = {
              ...item,
              option: {
                ...item.option,
                with_proxy: false,
                self_proxy: true,
              },
            }

            if (openType === 'new') {
              await mutate(
                () => createProfile(retryItem, fileDataRef.current),
                {
                  id: 'create-profile',
                  errorNotice: false,
                },
              )
            } else {
              if (!form.uid) {
                throw new Error(
                  t('profiles.modals.profileForm.errors.uidMissing'),
                )
              }
              await mutate(() => patchProfile(form.uid!, retryItem), {
                id: 'patch-profile',
                errorNotice: false,
              })

              await mutate(
                () => patchProfile(form.uid!, { option: originalOptions }),
                {
                  id: 'patch-profile',
                  errorNotice: false,
                },
              )
            }

            showNotice.success(
              'profiles.modals.profileForm.feedback.notifications.creationSuccess',
            )
          }
        }

        setOpen(false)
        setTimeout(() => reset(), 500)
        fileDataRef.current = null

        setTimeout(() => {
          onChange(isActivating)
        }, 0)
      } catch (err) {
        showNotice.error('profiles.modals.profileForm.errors.saveFailed', err)
      } finally {
        setLoading(false)
      }
    }),
  )

  const handleClose = () => {
    try {
      setOpen(false)
      fileDataRef.current = null
      setTimeout(() => reset(), 500)
    } catch (e) {
      console.warn('[ProfileViewer] handleClose error:', e)
    }
  }

  const formType = watch('type')
  const isRemote = formType === 'remote'
  const isLocal = formType === 'local'

  return (
    <BaseDialog
      open={open}
      title={
        openType === 'new'
          ? t('profiles.modals.profileForm.title.create')
          : t('profiles.modals.profileForm.title.edit')
      }
      className="sm:max-w-md"
      okBtn={t('shared.actions.save')}
      cancelBtn={t('shared.actions.cancel')}
      onClose={handleClose}
      onCancel={handleClose}
      onOk={handleOk}
      loading={loading}
    >
      <FieldGroup className="gap-3 py-1">
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="profile-type">
                {t('profiles.modals.profileForm.fields.type')}
              </FieldLabel>
              <Select
                name={field.name}
                value={field.value ?? undefined}
                onValueChange={field.onChange}
              >
                <SelectTrigger
                  id="profile-type"
                  ref={field.ref}
                  autoFocus
                  className="w-full"
                  onBlur={field.onBlur}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">
                    {t('profiles.modals.profileForm.types.remote')}
                  </SelectItem>
                  <SelectItem value="local">
                    {t('profiles.modals.profileForm.types.local')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="profile-name">
                {t('shared.labels.name')}
              </FieldLabel>
              <Input
                id="profile-name"
                autoComplete="off"
                autoCorrect="off"
                {...field}
                value={field.value ?? ''}
              />
            </Field>
          )}
        />

        <Controller
          name="desc"
          control={control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="profile-desc">
                {t('profiles.modals.profileForm.fields.description')}
              </FieldLabel>
              <Input
                id="profile-desc"
                autoComplete="off"
                autoCorrect="off"
                {...field}
                value={field.value ?? ''}
              />
            </Field>
          )}
        />

        {isLocal && openType === 'new' && (
          <FileInput
            onChange={(file, val) => {
              setValue('name', getValues('name') || file.name)
              fileDataRef.current = val
            }}
          />
        )}

        {isRemote && (
          <>
            <Controller
              name="url"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="profile-url">
                    {t('profiles.modals.profileForm.fields.subscriptionUrl')}
                  </FieldLabel>
                  <Textarea
                    id="profile-url"
                    autoComplete="off"
                    autoCorrect="off"
                    className="min-h-7 break-all"
                    {...field}
                    value={field.value ?? ''}
                  />
                </Field>
              )}
            />

            <Controller
              name="option.user_agent"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="profile-user-agent">
                    {t('profiles.modals.profileForm.fields.userAgent')}
                  </FieldLabel>
                  <Input
                    id="profile-user-agent"
                    autoComplete="off"
                    autoCorrect="off"
                    placeholder={
                      happCompat ? HAPP_USER_AGENT : DEFAULT_USER_AGENT
                    }
                    {...field}
                    value={field.value ?? ''}
                  />
                </Field>
              )}
            />

            <Controller
              name="option.happ_compat"
              control={control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor="profile-happ-compat">
                      {t('profiles.modals.profileForm.fields.happCompat')}
                    </FieldLabel>
                    <FieldDescription>
                      {t('profiles.modals.profileForm.fields.happCompatHelper')}
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="profile-happ-compat"
                    checked={!!field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked)
                      handleHappCompatChange(checked)
                    }}
                  />
                </Field>
              )}
            />

            <Controller
              name="option.timeout_seconds"
              control={control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="profile-timeout">
                    {t('profiles.modals.profileForm.fields.httpTimeout')}
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="profile-timeout"
                      type="number"
                      autoComplete="off"
                      autoCorrect="off"
                      placeholder="60"
                      {...field}
                      value={field.value ?? ''}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>
                        {t('shared.units.seconds')}
                      </InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              )}
            />
            <Controller
              name="option.update_interval"
              control={control}
              render={({ field }) => {
                const interval = Number(field.value)
                const tooFrequent =
                  Number.isFinite(interval) &&
                  interval > 0 &&
                  interval < MIN_UPDATE_INTERVAL

                return (
                  <Field>
                    <FieldLabel htmlFor="profile-update-interval">
                      {t('profiles.modals.profileForm.fields.updateInterval')}
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="profile-update-interval"
                        type="number"
                        autoComplete="off"
                        autoCorrect="off"
                        {...field}
                        value={field.value ?? ''}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>
                          {t('shared.units.minutes')}
                        </InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    {tooFrequent && (
                      <FieldDescription className="text-warning">
                        {t(
                          'profiles.modals.profileForm.warnings.frequentUpdate',
                          { minutes: MIN_UPDATE_INTERVAL },
                        )}
                      </FieldDescription>
                    )}
                  </Field>
                )
              }}
            />
            <Controller
              name="option.with_proxy"
              control={control}
              render={({ field }) => (
                <SwitchField
                  id="profile-with-proxy"
                  label={t('profiles.modals.profileForm.fields.useSystemProxy')}
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            <Controller
              name="option.self_proxy"
              control={control}
              render={({ field }) => (
                <SwitchField
                  id="profile-self-proxy"
                  label={t('profiles.modals.profileForm.fields.useClashProxy')}
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            <Controller
              name="option.danger_accept_invalid_certs"
              control={control}
              render={({ field }) => (
                <SwitchField
                  id="profile-accept-invalid-certs"
                  label={t(
                    'profiles.modals.profileForm.fields.acceptInvalidCerts',
                  )}
                  checked={!!field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            <Controller
              name="option.allow_auto_update"
              control={control}
              render={({ field }) => (
                <SwitchField
                  id="profile-allow-auto-update"
                  label={t(
                    'profiles.modals.profileForm.fields.allowAutoUpdate',
                  )}
                  checked={field.value ?? true}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </>
        )}
      </FieldGroup>
    </BaseDialog>
  )
}
