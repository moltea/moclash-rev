import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useLockFn } from 'ahooks'
import {
  ClipboardPasteIcon,
  Maximize2Icon,
  Minimize2Icon,
  PaintbrushIcon,
  RotateCcwIcon,
} from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { showNotice } from '@/services/notice-service'
import { useThemeMode } from '@/services/states'
import type { MonacoEditorInstance, MonacoMarker } from '@/types/monaco'
import debounce from '@/utils/debounce'
import { MONACO_FONT_FAMILY } from '@/utils/font-family'
import { BaseLoadingOverlay, MonacoEditor } from '@ui/components/base'
import { Button } from '@ui/components/ui/button'
import { ButtonGroup } from '@ui/components/ui/button-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'

import { EditorDialog } from './editor-dialog'

const appWindow = getCurrentWebviewWindow()

type EditorLanguage = 'yaml' | 'javascript' | 'css'

export interface EditorViewerProps {
  open: boolean
  title?: string | ReactNode
  description?: ReactNode
  value: string
  language: EditorLanguage
  path: string
  readOnly?: boolean
  loading?: boolean
  dirty?: boolean
  saveDisabled?: boolean
  onChange?: (value: string) => void
  onSave?: () => void | Promise<void>
  onResetToDefault?: () => void
  onClose: () => void
  onValidate?: (markers: MonacoMarker[]) => void
}

export const EditorViewer = ({
  open,
  title,
  description,
  value,
  language,
  path,
  readOnly = false,
  loading = false,
  dirty,
  saveDisabled = false,
  onChange,
  onSave,
  onResetToDefault,
  onClose,
  onValidate,
}: EditorViewerProps) => {
  const { t } = useTranslation()
  const themeMode = useThemeMode()
  const [isMaximized, setIsMaximized] = useState(false)
  const editorRef = useRef<MonacoEditorInstance | null>(null)

  const resolvedTitle = title ?? t('profiles.components.menu.editFile')
  const disableSave = loading || saveDisabled || dirty === false

  const syncEditorValue = useCallback(() => {
    const model = editorRef.current?.getModel()
    if (model && model.getValue() !== value) {
      model.setValue(value)
    }
  }, [value])

  const syncMaximizedState = useCallback(async () => {
    try {
      setIsMaximized(await appWindow.isMaximized())
    } catch {
      setIsMaximized(false)
    }
  }, [])

  const handleSave = useLockFn(async () => {
    try {
      if (!readOnly) {
        await onSave?.()
      }
      onClose()
    } catch (error) {
      showNotice.error(error)
    }
  })

  const handleClose = () => {
    try {
      onClose()
    } catch (error) {
      showNotice.error(error)
    }
  }

  const handlePaste = useLockFn(async () => {
    try {
      if (readOnly || loading || !editorRef.current) return

      const text = await navigator.clipboard.readText()
      if (!text) return

      const editorInstance = editorRef.current
      const model = editorInstance.getModel()
      const selections = editorInstance.getSelections()
      if (!model || !selections || selections.length === 0) return

      editorInstance.pushUndoStop()
      editorInstance.executeEdits(
        'explicit-paste',
        selections.map((selection) => ({
          range: selection,
          text,
          forceMoveMarkers: true,
        })),
      )
      editorInstance.pushUndoStop()
      editorInstance.focus()
    } catch (error) {
      showNotice.error(error)
    }
  })

  const handleFormat = useLockFn(async () => {
    try {
      if (loading) return
      await editorRef.current?.getAction('editor.action.formatDocument')?.run()
    } catch (error) {
      showNotice.error(error)
    }
  })

  const handleToggleMaximize = useLockFn(async () => {
    try {
      await appWindow.toggleMaximize()
      await syncMaximizedState()
      editorRef.current?.layout()
    } catch (error) {
      showNotice.error(error)
    }
  })

  useEffect(() => {
    if (!open) return
    void syncMaximizedState()
  }, [open, syncMaximizedState])

  useEffect(() => {
    if (!open || loading) return
    syncEditorValue()
  }, [loading, open, syncEditorValue])

  useEffect(() => {
    if (!open) return

    const onResized = debounce(() => {
      void syncMaximizedState()
      try {
        editorRef.current?.layout()
      } catch {}
    }, 100)

    const unlistenResized = appWindow.onResized(onResized)

    return () => {
      unlistenResized.then((unlisten) => unlisten())
    }
  }, [open, syncMaximizedState])

  useEffect(() => {
    return () => {
      editorRef.current?.dispose()
      editorRef.current = null
    }
  }, [])

  const maximizeLabel = t(
    isMaximized ? 'shared.window.minimize' : 'shared.window.maximize',
  )

  return (
    <EditorDialog
      open={open}
      title={resolvedTitle}
      contentClassName="gap-3"
      onClose={handleClose}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <ButtonGroup>
            {!readOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t('profiles.page.importForm.actions.paste')}
                    disabled={loading}
                    onClick={() => {
                      void handlePaste()
                    }}
                  >
                    <ClipboardPasteIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('profiles.page.importForm.actions.paste')}
                </TooltipContent>
              </Tooltip>
            )}
            {!readOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t('profiles.modals.editor.actions.format')}
                    disabled={loading}
                    onClick={() => {
                      void handleFormat()
                    }}
                  >
                    <PaintbrushIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('profiles.modals.editor.actions.format')}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={maximizeLabel}
                  onClick={() => {
                    void handleToggleMaximize()
                  }}
                >
                  {isMaximized ? <Minimize2Icon /> : <Maximize2Icon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{maximizeLabel}</TooltipContent>
            </Tooltip>
          </ButtonGroup>

          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {!readOnly && onResetToDefault && (
              <Button
                variant="outline"
                className="text-warning"
                disabled={loading}
                onClick={onResetToDefault}
              >
                <RotateCcwIcon data-icon="inline-start" />
                {t('shared.actions.resetToDefault')}
              </Button>
            )}
            <Button variant="outline" onClick={handleClose}>
              {t(readOnly ? 'shared.actions.close' : 'shared.actions.cancel')}
            </Button>
            {!readOnly && (
              <Button
                disabled={disableSave}
                onClick={() => {
                  void handleSave()
                }}
              >
                {t('shared.actions.save')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {description}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border">
        <BaseLoadingOverlay isLoading={loading} />
        {!loading && (
          <MonacoEditor
            height="100%"
            path={path}
            value={value}
            language={language}
            theme={themeMode === 'light' ? 'light' : 'vs-dark'}
            loading={null}
            saveViewState
            keepCurrentModel={false}
            onMount={(editorInstance) => {
              editorRef.current = editorInstance
              syncEditorValue()
            }}
            onChange={(nextValue) => onChange?.(nextValue ?? '')}
            onValidate={onValidate}
            options={{
              automaticLayout: true,
              tabSize: 2,
              minimap: {
                enabled:
                  typeof document !== 'undefined' &&
                  document.documentElement.clientWidth >= 1500,
              },
              mouseWheelZoom: true,
              readOnly,
              readOnlyMessage: {
                value: t('profiles.modals.editor.messages.readOnly'),
              },
              renderValidationDecorations: 'on',
              quickSuggestions: {
                strings: true,
                comments: true,
                other: true,
              },
              padding: {
                top: 33,
              },
              fontFamily: MONACO_FONT_FAMILY,
              fontLigatures: false,
              smoothScrolling: true,
            }}
          />
        )}
      </div>
    </EditorDialog>
  )
}
