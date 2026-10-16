import {
  CheckIcon,
  ExternalLinkIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@ui/components/ui/button'
import { Input } from '@ui/components/ui/input'
import { Separator } from '@ui/components/ui/separator'
import { cn } from '@ui/lib/utils'

interface Props {
  value?: string
  onlyEdit?: boolean
  onChange: (value?: string) => void
  onOpenUrl?: (value?: string) => void
  onDelete?: () => void
  onCancel?: () => void
}

export const WebUIItem = (props: Props) => {
  const {
    value,
    onlyEdit = false,
    onChange,
    onDelete,
    onOpenUrl,
    onCancel,
  } = props

  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const { t } = useTranslation()

  const highlightedParts = useMemo(() => {
    const placeholderRegex = /(%host|%port|%secret)/g
    if (!value) {
      return ['NULL']
    }
    return value.split(placeholderRegex).filter((part) => part !== '')
  }, [value])

  if (editing || onlyEdit) {
    return (
      <>
        <div className="flex items-center gap-1 py-2">
          <Input
            autoComplete="new-password"
            className="flex-1"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder={t(
              'settings.modals.webUI.messages.supportedPlaceholders',
            )}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            title={t('shared.actions.save')}
            aria-label={t('shared.actions.save')}
            onClick={() => {
              onChange(editValue)
              setEditing(false)
            }}
          >
            <CheckIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title={t('shared.actions.cancel')}
            aria-label={t('shared.actions.cancel')}
            onClick={() => {
              onCancel?.()
              setEditing(false)
            }}
          >
            <XIcon />
          </Button>
        </div>
        <Separator />
      </>
    )
  }

  const renderedParts = highlightedParts.map((part, index) => {
    const isPlaceholder =
      part === '%host' || part === '%port' || part === '%secret'
    const repeatIndex = highlightedParts
      .slice(0, index)
      .filter((prev) => prev === part).length
    const key = `${part || 'empty'}-${repeatIndex}`

    return (
      <span key={key} className={cn(isPlaceholder && 'text-primary')}>
        {part}
      </span>
    )
  })

  return (
    <>
      <div className="flex items-center gap-1 py-2">
        <div
          title={value}
          className={cn(
            'min-w-0 flex-1 truncate text-xs',
            value ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {renderedParts}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          title={t('settings.modals.webUI.actions.openUrl')}
          aria-label={t('settings.modals.webUI.actions.openUrl')}
          onClick={() => onOpenUrl?.(value)}
        >
          <ExternalLinkIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={t('shared.actions.edit')}
          aria-label={t('shared.actions.edit')}
          onClick={() => {
            setEditing(true)
            setEditValue(value)
          }}
        >
          <PencilIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={t('shared.actions.delete')}
          aria-label={t('shared.actions.delete')}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      </div>
      <Separator />
    </>
  )
}
