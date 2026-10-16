import { useLockFn } from 'ahooks'
import { EllipsisVerticalIcon, ScrollTextIcon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useEditorDocument } from '@/hooks/use-editor-document'
import { readProfileFile, saveProfileFile, viewProfile } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import type { TranslationKey } from '@/types/generated/i18n-keys'
import { EditorViewer } from '@ui/components/profile/editor-viewer'
import { Badge } from '@ui/components/ui/badge'
import { Button } from '@ui/components/ui/button'
import { CardAction, CardHeader, CardTitle } from '@ui/components/ui/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@ui/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@ui/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'

import { EnhanceHint } from './enhance-hint'
import { LogViewer } from './log-viewer'
import { ProfileBox } from './profile-box'

interface Props {
  logInfo?: [string, string][]
  id: 'Merge' | 'Script'
  onSave?: (prev?: string, curr?: string) => void
}

const EMPTY_LOG_INFO: [string, string][] = []

const DEFAULT_SCRIPT = `// Define main function (script entry)

function main(config, profileName) {
  return config;
}
`

const globalTitles: Record<Props['id'], TranslationKey> = {
  Merge: 'profiles.components.more.global.merge',
  Script: 'profiles.components.more.global.script',
}

const chipLabels: Record<Props['id'], TranslationKey> = {
  Merge: 'profiles.components.more.chips.merge',
  Script: 'profiles.components.more.chips.script',
}

export const ProfileMore = (props: Props) => {
  const { id, logInfo, onSave } = props

  const entries = logInfo ?? EMPTY_LOG_INFO
  const { t } = useTranslation()
  const [fileOpen, setFileOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  const loadDocument = useCallback(() => readProfileFile(id), [id])
  const document = useEditorDocument({
    open: fileOpen,
    load: loadDocument,
  })

  const onEditFile = () => {
    setFileOpen(true)
  }

  const onOpenFile = useLockFn(async () => {
    try {
      await mutate(() => viewProfile(id), {
        id: 'view-profile',
        errorNotice: false,
      })
    } catch (err) {
      showNotice.error(err)
    }
  })

  const hasError = entries.some(([level]) => level === 'exception')

  const itemMenu: { label: TranslationKey; handler: () => void }[] = [
    { label: 'profiles.components.menu.editFile', handler: onEditFile },
    { label: 'profiles.components.menu.openFile', handler: onOpenFile },
  ]

  const handleSave = useLockFn(async () => {
    const currentValue = document.value
    const result = await mutate(() => saveProfileFile(id, currentValue), {
      id: `save-profile-file:${id}`,
      errorNotice: false,
    })
    if (!(result.ok && result.value === true)) {
      await document.reload()
      return
    }
    onSave?.(document.savedValue, currentValue)
    document.markSaved(currentValue)
  })

  const handleResetToDefault = useCallback(() => {
    document.setValue(DEFAULT_SCRIPT)
  }, [document])

  return (
    <>
      <ContextMenu modal={false}>
        <ContextMenuTrigger asChild>
          <ProfileBox className="h-full" onDoubleClick={onEditFile}>
            <CardHeader>
              <CardTitle
                className="truncate text-foreground"
                title={t(globalTitles[id])}
              >
                {t(globalTitles[id])}
              </CardTitle>
              <CardAction className="flex items-center gap-1">
                <Badge variant="outline" className="text-primary capitalize">
                  {t(chipLabels[id])}
                </Badge>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t('shared.actions.edit')}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <EllipsisVerticalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onDoubleClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                  >
                    {itemMenu.map((item) => (
                      <DropdownMenuItem
                        key={item.label}
                        onSelect={() => item.handler()}
                      >
                        {t(item.label)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardAction>
            </CardHeader>

            <div className="flex h-6 items-center px-(--card-spacing)">
              {id === 'Script' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={
                        hasError
                          ? 'relative -ms-1 text-destructive'
                          : 'relative -ms-1'
                      }
                      aria-label={t('profiles.modals.logViewer.title')}
                      onClick={() => setLogOpen(true)}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <ScrollTextIcon />
                      {hasError && (
                        <span className="absolute end-0.5 top-0.5 size-1.5 rounded-full bg-destructive" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('profiles.modals.logViewer.title')}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </ProfileBox>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {itemMenu.map((item) => (
            <ContextMenuItem key={item.label} onSelect={() => item.handler()}>
              {t(item.label)}
            </ContextMenuItem>
          ))}
        </ContextMenuContent>
      </ContextMenu>
      {fileOpen && (
        <EditorViewer
          open={true}
          title={t(globalTitles[id])}
          description={
            <EnhanceHint
              stage={id === 'Merge' ? 'globalMerge' : 'globalScript'}
            />
          }
          value={document.value}
          language={id === 'Merge' ? 'yaml' : 'javascript'}
          path={`profile-more:${id}.${id === 'Merge' ? 'yaml' : 'js'}`}
          loading={document.loading}
          dirty={document.dirty}
          onChange={document.setValue}
          onSave={handleSave}
          onResetToDefault={id === 'Script' ? handleResetToDefault : undefined}
          onClose={() => setFileOpen(false)}
        />
      )}
      {logOpen && (
        <LogViewer
          open={logOpen}
          logInfo={entries}
          onClose={() => setLogOpen(false)}
        />
      )}
    </>
  )
}
