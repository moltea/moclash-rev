import { useLockFn } from 'ahooks'
import { PencilIcon } from 'lucide-react'
import {
  type ChangeEvent,
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useVerge } from '@/hooks/use-verge'
import { defaultDarkTheme, defaultTheme } from '@/pages/_theme'
import { showNotice } from '@/services/notice-service'
import { useThemeMode } from '@/services/states'
import { BaseDialog, type DialogRef } from '@ui/components/base'
import { EditorViewer } from '@ui/components/profile/editor-viewer'
import { Button } from '@ui/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'

export function ThemeViewer(props: { ref?: Ref<DialogRef> }) {
  const { ref } = props
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [cssEditorValue, setCssEditorValue] = useState('')
  const [cssEditorSavedValue, setCssEditorSavedValue] = useState('')
  const { verge, patchVerge } = useVerge()
  const { theme_setting } = verge ?? {}
  const [theme, setTheme] = useState(theme_setting || {})
  const themeRef = useRef(theme)
  useEffect(() => {
    themeRef.current = theme
  }, [theme])

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true)
      setTheme({ ...theme_setting })
    },
    close: () => setOpen(false),
  }))

  const handleChange =
    (field: keyof typeof theme) => (e: ChangeEvent<HTMLInputElement>) => {
      setTheme((t) => ({ ...t, [field]: e.target.value }))
    }

  const onSave = useLockFn(async () => {
    try {
      await patchVerge({ theme_setting: theme })
      setOpen(false)
    } catch (err) {
      showNotice.error(err)
    }
  })

  const mode = useThemeMode()

  const dt = mode === 'light' ? defaultTheme : defaultDarkTheme

  type ThemeKey = keyof typeof theme & keyof typeof defaultTheme

  const fieldDefinitions: Array<{ labelKey: string; key: ThemeKey }> = useMemo(
    () => [
      {
        labelKey: 'settings.components.verge.theme.fields.primaryColor',
        key: 'primary_color',
      },
      {
        labelKey: 'settings.components.verge.theme.fields.secondaryColor',
        key: 'secondary_color',
      },
      {
        labelKey: 'settings.components.verge.theme.fields.primaryText',
        key: 'primary_text',
      },
      {
        labelKey: 'settings.components.verge.theme.fields.secondaryText',
        key: 'secondary_text',
      },
      {
        labelKey: 'settings.components.verge.theme.fields.infoColor',
        key: 'info_color',
      },
      {
        labelKey: 'settings.components.verge.theme.fields.warningColor',
        key: 'warning_color',
      },
      {
        labelKey: 'settings.components.verge.theme.fields.errorColor',
        key: 'error_color',
      },
      {
        labelKey: 'settings.components.verge.theme.fields.successColor',
        key: 'success_color',
      },
    ],
    [],
  )

  const openCssEditor = () => {
    const nextCss = themeRef.current?.css_injection ?? ''
    setCssEditorValue(nextCss)
    setCssEditorSavedValue(nextCss)
    setEditorOpen(true)
  }

  const handleSaveCss = useLockFn(async () => {
    const prevTheme = themeRef.current || {}
    setTheme({ ...prevTheme, css_injection: cssEditorValue })
    setCssEditorSavedValue(cssEditorValue)
  })

  const renderItem = (labelKey: string, key: ThemeKey) => {
    const id = `theme-${key}`
    return (
      <Field key={key} orientation="horizontal">
        <FieldLabel htmlFor={id}>{t(labelKey)}</FieldLabel>
        <span
          className="size-5 shrink-0 rounded-full border"
          style={{ background: theme[key] || dt[key] }}
        />
        <Input
          id={id}
          autoComplete="off"
          className="w-36"
          value={theme[key] ?? ''}
          placeholder={dt[key]}
          onChange={handleChange(key)}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
        />
      </Field>
    )
  }

  return (
    <BaseDialog
      open={open}
      title={t('settings.components.verge.theme.title')}
      okBtn={t('shared.actions.save')}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
      onOk={onSave}
    >
      <FieldGroup className="gap-3 py-1">
        {fieldDefinitions.map((field) => renderItem(field.labelKey, field.key))}

        <Field orientation="horizontal">
          <FieldLabel htmlFor="theme-font-family">
            {t('settings.components.verge.theme.fields.fontFamily')}
          </FieldLabel>
          <Input
            id="theme-font-family"
            autoComplete="off"
            className="w-36"
            value={theme.font_family ?? ''}
            onChange={handleChange('font_family')}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldLabel>
            {t('settings.components.verge.theme.fields.cssInjection')}
          </FieldLabel>
          <Button variant="outline" onClick={openCssEditor}>
            <PencilIcon data-icon="inline-start" />
            {t('settings.components.verge.theme.actions.editCss')}
          </Button>
        </Field>
      </FieldGroup>

      {editorOpen && (
        <EditorViewer
          open={true}
          title={t('settings.components.verge.theme.dialogs.editCssTitle')}
          value={cssEditorValue}
          language="css"
          path="theme-css.css"
          dirty={cssEditorValue !== cssEditorSavedValue}
          onChange={setCssEditorValue}
          onSave={handleSaveCss}
          onClose={() => {
            setEditorOpen(false)
          }}
        />
      )}
    </BaseDialog>
  )
}
