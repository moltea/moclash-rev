import { useLockFn } from 'ahooks'
import { memo, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { useVerge } from '@/hooks/use-verge'
import { createWebdavBackup, saveWebdavConfig } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { errorDetail, showNotice } from '@/services/notice-service'
import {
  buildWebdavSignature,
  getWebdavStatus,
  setWebdavStatus,
} from '@/services/webdav-status'
import { isValidUrl } from '@/utils/network'
import { Button } from '@ui/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'

interface BackupConfigViewerProps {
  onBackupSuccess: () => Promise<void>
  onSaveSuccess: (signature?: string) => Promise<void>
  onRefresh: () => Promise<void>
  onInit: () => Promise<void>
  setLoading: (loading: boolean) => void
}

export const BackupConfigViewer = memo(
  ({
    onBackupSuccess,
    onSaveSuccess,
    onRefresh,
    onInit,
    setLoading,
  }: BackupConfigViewerProps) => {
    const { t } = useTranslation()
    const { verge, mutateVerge } = useVerge()
    const { webdav_url, webdav_username, webdav_password } = verge || {}
    const usernameRef = useRef<HTMLInputElement>(null)
    const passwordRef = useRef<HTMLInputElement>(null)
    const urlRef = useRef<HTMLInputElement>(null)

    const { register, handleSubmit, watch } = useForm<IWebDavConfig>({
      defaultValues: {
        url: webdav_url!,
        username: webdav_username!,
        password: webdav_password!,
      },
    })
    const url = watch('url')
    const username = watch('username')
    const password = watch('password')

    const { ref: urlFieldRef, ...urlField } = register('url')
    const { ref: usernameFieldRef, ...usernameField } = register('username')
    const { ref: passwordFieldRef, ...passwordField } = register('password')

    const webdavChanged =
      webdav_url !== url ||
      webdav_username !== username ||
      webdav_password !== password

    const webdavSignature = buildWebdavSignature(verge)
    const webdavStatus = getWebdavStatus(webdavSignature)
    const shouldAutoInit = webdavStatus !== 'failed'

    useEffect(() => {
      if (!webdav_url || !webdav_username || !webdav_password) {
        return
      }
      if (!shouldAutoInit) {
        return
      }
      void onInit()
    }, [webdav_url, webdav_username, webdav_password, onInit, shouldAutoInit])

    const checkForm = () => {
      const username = usernameRef.current?.value
      const password = passwordRef.current?.value
      const url = urlRef.current?.value

      if (!url) {
        urlRef.current?.focus()
        showNotice.error('settings.modals.backup.messages.webdavUrlRequired')
        throw new Error(t('settings.modals.backup.messages.webdavUrlRequired'))
      } else if (!isValidUrl(url)) {
        urlRef.current?.focus()
        showNotice.error('settings.modals.backup.messages.invalidWebdavUrl')
        throw new Error(t('settings.modals.backup.messages.invalidWebdavUrl'))
      }
      if (!username) {
        usernameRef.current?.focus()
        showNotice.error('settings.modals.backup.messages.usernameRequired')
        throw new Error(t('settings.modals.backup.messages.usernameRequired'))
      }
      if (!password) {
        passwordRef.current?.focus()
        showNotice.error('settings.modals.backup.messages.passwordRequired')
        throw new Error(t('settings.modals.backup.messages.passwordRequired'))
      }
    }

    const save = useLockFn(async (data: IWebDavConfig) => {
      checkForm()
      const signature = buildWebdavSignature({
        webdav_url: data.url,
        webdav_username: data.username,
        webdav_password: data.password,
      })
      const trimmedUrl = data.url.trim()
      const trimmedUsername = data.username.trim()

      try {
        setLoading(true)
        await mutate(
          () => saveWebdavConfig(trimmedUrl, trimmedUsername, data.password),
          {
            id: 'save-webdav-config',
            errorNotice: false,
          },
        )
        await mutateVerge(
          (current) =>
            current
              ? {
                  ...current,
                  webdav_url: trimmedUrl,
                  webdav_username: trimmedUsername,
                  webdav_password: data.password,
                }
              : current,
          false,
        )
        setWebdavStatus(signature, 'unknown')
        showNotice.success('settings.modals.backup.messages.webdavConfigSaved')
        await onSaveSuccess(signature)
      } catch (error) {
        showNotice.error(
          'settings.modals.backup.messages.webdavConfigSaveFailed',
          { error: errorDetail(error) },
          3000,
        )
      } finally {
        setLoading(false)
      }
    })

    const handleBackup = useLockFn(async () => {
      checkForm()
      const signature = buildWebdavSignature({
        webdav_url: url,
        webdav_username: username,
        webdav_password: password,
      })

      try {
        setLoading(true)
        await mutate(() => createWebdavBackup(), {
          id: 'create-webdav-backup',
          errorNotice: false,
        }).then(async () => {
          showNotice.success('settings.modals.backup.messages.backupCreated')
          await onBackupSuccess()
        })
        setWebdavStatus(signature, 'ready')
      } catch (error) {
        showNotice.error('settings.modals.backup.messages.backupFailed', {
          error,
        })
        setWebdavStatus(signature, 'failed')
      } finally {
        setLoading(false)
      }
    })

    const needsSave =
      webdavChanged ||
      webdav_url === undefined ||
      webdav_username === undefined ||
      webdav_password === undefined

    return (
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={(e) => e.preventDefault()}
      >
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="webdav-url">
              {t('settings.modals.backup.fields.webdavUrl')}
            </FieldLabel>
            <Input
              id="webdav-url"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              {...urlField}
              ref={(el) => {
                urlFieldRef(el)
                urlRef.current = el
              }}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="webdav-username">
                {t('settings.modals.backup.fields.username')}
              </FieldLabel>
              <Input
                id="webdav-username"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                {...usernameField}
                ref={(el) => {
                  usernameFieldRef(el)
                  usernameRef.current = el
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="webdav-password">
                {t('shared.labels.password')}
              </FieldLabel>
              <Input
                id="webdav-password"
                type="password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                {...passwordField}
                ref={(el) => {
                  passwordFieldRef(el)
                  passwordRef.current = el
                }}
              />
            </Field>
          </div>
        </FieldGroup>
        <div className="flex flex-col justify-end gap-2 sm:w-28">
          {needsSave ? (
            <Button
              type="button"
              className="h-full"
              onClick={handleSubmit(save)}
            >
              {t('shared.actions.save')}
            </Button>
          ) : (
            <>
              <Button type="button" size="lg" onClick={handleBackup}>
                {t('settings.modals.backup.actions.backup')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onRefresh}
              >
                {t('shared.actions.refresh')}
              </Button>
            </>
          )}
        </div>
      </form>
    )
  },
)
