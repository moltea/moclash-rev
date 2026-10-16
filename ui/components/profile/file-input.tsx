import { useLockFn } from 'ahooks'
import { type ChangeEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@ui/components/ui/button'

interface Props {
  onChange: (file: File, value: string) => void
}

export const FileInput = (props: Props) => {
  const { onChange } = props

  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')

  const onFileInput = useLockFn(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) return

    setFileName(file.name)
    setLoading(true)

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (event) => {
        resolve(null)
        onChange(file, event.target?.result as string)
      }
      reader.onerror = reject
      reader.readAsText(file)
    }).finally(() => setLoading(false))
  })

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className="shrink-0"
        onClick={() => inputRef.current?.click()}
      >
        {t('profiles.components.fileInput.chooseFile')}
      </Button>

      <input
        type="file"
        accept=".yaml,.yml"
        ref={inputRef}
        className="hidden"
        onChange={onFileInput}
      />

      <span className="truncate text-muted-foreground">
        {loading ? t('shared.statuses.loading') : fileName}
      </span>
    </div>
  )
}
