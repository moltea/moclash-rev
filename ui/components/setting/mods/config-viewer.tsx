import { forwardRef, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getRuntimeYaml } from '@/services/cmds'
import type { DialogRef } from '@ui/components/base'
import { EditorViewer } from '@ui/components/profile/editor-viewer'
import { Badge } from '@ui/components/ui/badge'

export const ConfigViewer = forwardRef<DialogRef>((_, ref) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [runtimeConfig, setRuntimeConfig] = useState('')

  useImperativeHandle(ref, () => ({
    open: () => {
      setRuntimeConfig('')
      setLoading(true)
      setOpen(true)
      getRuntimeYaml()
        .then((data) => {
          setRuntimeConfig(data ?? '# Error getting runtime yaml\n')
        })
        .catch(() => {
          setRuntimeConfig('# Error getting runtime yaml\n')
        })
        .finally(() => {
          setLoading(false)
        })
    },
    close: () => setOpen(false),
  }))

  if (!open) return null
  return (
    <EditorViewer
      open={true}
      title={
        <span className="flex items-center gap-2">
          {t('settings.components.verge.advanced.fields.runtimeConfig')}
          <Badge variant="secondary">{t('shared.labels.readOnly')}</Badge>
        </span>
      }
      value={runtimeConfig}
      readOnly
      language="yaml"
      path="runtime-config.yaml"
      loading={loading}
      onClose={() => setOpen(false)}
    />
  )
})
