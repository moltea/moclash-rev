import { useLockFn, useRequest } from 'ahooks'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useClash } from '@/hooks/use-clash'
import { restartCore } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { BaseDialog } from '@ui/components/base'
import { Alert, AlertDescription } from '@ui/components/ui/alert'
import { Button } from '@ui/components/ui/button'
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'
import { Switch } from '@ui/components/ui/switch'

const DEV_URLS = [
  'tauri://localhost',
  'http://tauri.localhost',
  'http://localhost:3000',
]

const getFullOrigins = (origins: string[]) => {
  const allOrigins = [...origins, ...DEV_URLS]
  const uniqueOrigins = [...new Set(allOrigins)]
  return uniqueOrigins
}

const filterBaseOriginsForUI = (origins: string[]) => {
  return origins.filter((origin: string) => !DEV_URLS.includes(origin.trim()))
}

interface ClashHeaderConfigingRef {
  open: () => void
  close: () => void
}

interface AllowOriginItem {
  key: number
  value: string
}

export const HeaderConfiguration = forwardRef<ClashHeaderConfigingRef>(
  (props, ref) => {
    const { t } = useTranslation()
    const { clash, mutateClash, patchClash } = useClash()
    const [open, setOpen] = useState(false)

    const lastKeyRef = useRef(0)

    const [corsConfig, setCorsConfig] = useState<{
      allowPrivateNetwork: boolean
      allowOrigins: AllowOriginItem[]
    }>(() => {
      const cors = clash?.['external-controller-cors']
      const origins = cors?.['allow-origins'] ?? []
      return {
        allowPrivateNetwork: cors?.['allow-private-network'] ?? true,
        allowOrigins: filterBaseOriginsForUI(origins).map((origin) => {
          lastKeyRef.current += 1
          return { key: lastKeyRef.current, value: origin }
        }),
      }
    })

    const handleCorsConfigChange = (
      key: 'allowPrivateNetwork' | 'allowOrigins',
      value: boolean | AllowOriginItem[],
    ) => {
      setCorsConfig((prev) => ({
        ...prev,
        [key]: value,
      }))
    }

    const handleAddOrigin = () => {
      lastKeyRef.current += 1
      handleCorsConfigChange('allowOrigins', [
        ...corsConfig.allowOrigins,
        { key: lastKeyRef.current, value: '' },
      ])
    }

    const handleUpdateOrigin = (index: number, value: string) => {
      const newOrigins = [...corsConfig.allowOrigins]
      newOrigins[index] = { ...newOrigins[index], value }
      handleCorsConfigChange('allowOrigins', newOrigins)
    }

    const handleDeleteOrigin = (index: number) => {
      const newOrigins = [...corsConfig.allowOrigins]
      newOrigins.splice(index, 1)
      handleCorsConfigChange('allowOrigins', newOrigins)
    }

    const { loading, run: saveConfig } = useRequest(
      async () => {
        const fullOrigins = getFullOrigins(
          corsConfig.allowOrigins.map((origin) => origin.value),
        )

        await patchClash({
          'external-controller-cors': {
            'allow-private-network': corsConfig.allowPrivateNetwork,
            'allow-origins': fullOrigins.filter(
              (origin: string) => origin.trim() !== '',
            ),
          },
        })
        await mutate(() => restartCore(), {
          id: 'restart-core',
          errorNotice: false,
        })
        await mutateClash()
      },
      {
        manual: true,
        onSuccess: () => {
          setOpen(false)
          showNotice.success('shared.feedback.notifications.common.saveSuccess')
        },
        onError: () => {
          showNotice.error('shared.feedback.notifications.common.saveFailed')
        },
      },
    )

    useImperativeHandle(ref, () => ({
      open: () => {
        const cors = clash?.['external-controller-cors']
        const origins = cors?.['allow-origins'] ?? []
        lastKeyRef.current = 0
        setCorsConfig({
          allowPrivateNetwork: cors?.['allow-private-network'] ?? true,
          allowOrigins: filterBaseOriginsForUI(origins).map((origin) => {
            lastKeyRef.current += 1
            return { key: lastKeyRef.current, value: origin }
          }),
        })
        setOpen(true)
      },
      close: () => setOpen(false),
    }))

    const handleSave = useLockFn(async () => {
      await saveConfig()
    })

    return (
      <BaseDialog
        open={open}
        title={t('settings.sections.externalCors.title')}
        className="sm:max-w-lg"
        okBtn={loading ? t('shared.statuses.saving') : t('shared.actions.save')}
        cancelBtn={t('shared.actions.cancel')}
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        onOk={handleSave}
      >
        <FieldGroup className="gap-4 py-1">
          <Field orientation="horizontal">
            <FieldLabel htmlFor="cors-allow-private-network">
              {t('settings.sections.externalCors.fields.allowPrivateNetwork')}
            </FieldLabel>
            <Switch
              id="cors-allow-private-network"
              checked={corsConfig.allowPrivateNetwork}
              onCheckedChange={(checked) =>
                handleCorsConfigChange('allowPrivateNetwork', checked)
              }
            />
          </Field>

          <FieldSeparator />

          <FieldSet>
            <FieldLegend variant="label">
              {t('settings.sections.externalCors.fields.allowedOrigins')}
            </FieldLegend>
            <div className="flex flex-col gap-2">
              {corsConfig.allowOrigins.map(({ key, value: origin }, index) => (
                <div key={key} className="flex items-center gap-2">
                  <Input
                    value={origin}
                    aria-label={t(
                      'settings.sections.externalCors.fields.allowedOrigins',
                    )}
                    placeholder={t(
                      'settings.sections.externalCors.placeholders.origin',
                    )}
                    onChange={(e) => handleUpdateOrigin(index, e.target.value)}
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    aria-label={t('shared.actions.delete')}
                    disabled={corsConfig.allowOrigins.length <= 0}
                    onClick={() => handleDeleteOrigin(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={handleAddOrigin}
              >
                <PlusIcon data-icon="inline-start" />
                {t('settings.sections.externalCors.actions.add')}
              </Button>
            </div>
            <Alert>
              <AlertDescription className="italic">
                {t('settings.sections.externalCors.messages.alwaysIncluded', {
                  urls: DEV_URLS.join(', '),
                })}
              </AlertDescription>
            </Alert>
          </FieldSet>
        </FieldGroup>
      </BaseDialog>
    )
  },
)
