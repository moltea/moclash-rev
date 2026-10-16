import {
  getCurrentWebviewWindow,
  type WebviewWindow,
} from '@tauri-apps/api/webviewWindow'
import type { Theme as TauriOsTheme } from '@tauri-apps/api/window'
import { useEffect, useMemo } from 'react'

import { useVerge } from '@/hooks/use-verge'
import { useSetThemeMode, useThemeMode } from '@/services/states'
import getSystem from '@/utils/get-system'

const OS = getSystem()

const CSS_INJECTION_SCOPE_ROOT = '[data-css-injection-root]'
const CSS_INJECTION_SCOPE_LIMIT =
  ':is(.monaco-editor .view-lines, .monaco-editor .view-line, .monaco-editor .margin, .monaco-editor .margin-view-overlays, .monaco-editor .view-overlays, .monaco-editor [class^="mtk"], .monaco-editor [class*=" mtk"])'
const TOP_LEVEL_AT_RULES = [
  '@charset',
  '@import',
  '@namespace',
  '@font-face',
  '@keyframes',
  '@counter-style',
  '@page',
  '@property',
  '@font-feature-values',
  '@color-profile',
]

const BASE_FONT_FAMILY = `'Inter Variable', -apple-system, BlinkMacSystemFont, "Microsoft YaHei UI", "Microsoft YaHei", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji"${
  OS === 'windows' ? ', twemoji mozilla' : ''
}`

const THEME_COLOR_VARS = {
  primary_color: ['--primary', '--ring', '--sidebar-primary'],
  secondary_color: ['--chart-2'],
  primary_text: ['--foreground', '--card-foreground', '--popover-foreground'],
  secondary_text: ['--muted-foreground'],
  info_color: ['--info'],
  error_color: ['--destructive'],
  warning_color: ['--warning'],
  success_color: ['--success'],
} as const

let cssScopeSupport: boolean | null = null

const canUseCssScope = () => {
  if (cssScopeSupport !== null) return cssScopeSupport
  try {
    const testStyle = document.createElement('style')
    testStyle.textContent = '@scope (:root) { }'
    document.head.appendChild(testStyle)
    cssScopeSupport = !!testStyle.sheet?.cssRules?.length
    document.head.removeChild(testStyle)
  } catch {
    cssScopeSupport = false
  }
  return cssScopeSupport
}

const wrapCssInjectionWithScope = (css?: string) => {
  if (!css?.trim()) return ''
  const lowerCss = css.toLowerCase()
  if (TOP_LEVEL_AT_RULES.some((rule) => lowerCss.includes(rule))) return null
  return `@scope (${CSS_INJECTION_SCOPE_ROOT}) to (${CSS_INJECTION_SCOPE_LIMIT}) {
${css}
}`
}

export const useCustomTheme = () => {
  const appWindow: WebviewWindow = useMemo(() => getCurrentWebviewWindow(), [])
  const { verge } = useVerge()
  const { theme_mode, theme_setting } = verge ?? {}
  const mode = useThemeMode()
  const setMode = useSetThemeMode()

  useEffect(() => {
    if (theme_mode === 'light' || theme_mode === 'dark') {
      setMode(theme_mode)
    }
  }, [theme_mode, setMode])

  useEffect(() => {
    if (theme_mode !== 'system') return

    let isMounted = true

    const timerId = setTimeout(() => {
      if (!isMounted) return
      appWindow
        .theme()
        .then((systemTheme) => {
          if (isMounted && systemTheme) setMode(systemTheme)
        })
        .catch((err) => {
          console.error('Failed to get initial system theme:', err)
        })
    }, 0)

    const unlistenPromise = appWindow.onThemeChanged(({ payload }) => {
      if (isMounted) setMode(payload)
    })

    return () => {
      isMounted = false
      clearTimeout(timerId)
      unlistenPromise
        .then((unlisten) => unlisten())
        .catch((err) => {
          console.error('Failed to unlisten from theme changes:', err)
        })
    }
  }, [theme_mode, appWindow, setMode])

  useEffect(() => {
    if (theme_mode === undefined) return

    if (theme_mode === 'system') {
      appWindow.setTheme(null).catch((err) => {
        console.error('Failed to set window theme to follow system:', err)
      })
    } else if (mode) {
      appWindow.setTheme(mode as TauriOsTheme).catch((err) => {
        console.error(`Failed to set window theme to ${mode}:`, err)
      })
    }
  }, [mode, appWindow, theme_mode])

  useEffect(() => {
    const root = document.documentElement
    const setting = theme_setting ?? {}

    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
    root.setAttribute('data-css-injection-root', 'true')

    for (const [key, vars] of Object.entries(THEME_COLOR_VARS)) {
      const value = setting[key as keyof typeof THEME_COLOR_VARS]
      for (const cssVar of vars) {
        if (value) {
          root.style.setProperty(cssVar, value)
        } else {
          root.style.removeProperty(cssVar)
        }
      }
    }

    root.style.setProperty(
      '--font-sans',
      setting.font_family
        ? `${setting.font_family}, ${BASE_FONT_FAMILY}`
        : BASE_FONT_FAMILY,
    )

    const backgroundImage = setting.background_image || ''
    root.style.setProperty(
      '--user-background-image',
      backgroundImage ? `url('${backgroundImage}')` : 'none',
    )
    root.style.setProperty(
      '--background-blend-mode',
      setting.background_blend_mode || 'normal',
    )
    root.style.setProperty(
      '--background-opacity',
      setting.background_opacity !== undefined
        ? String(setting.background_opacity)
        : '1',
    )

    let styleElement = document.querySelector('style#verge-theme')
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = 'verge-theme'
      document.head.appendChild(styleElement)
    }

    const scopedCss =
      canUseCssScope() && setting.css_injection
        ? wrapCssInjectionWithScope(setting.css_injection)
        : null
    const injectedCss = scopedCss ?? setting.css_injection ?? ''
    const backgroundCss = backgroundImage
      ? `
        body {
          background-image: var(--user-background-image);
          background-size: cover;
          background-position: center;
          background-attachment: fixed;
          background-blend-mode: var(--background-blend-mode);
          opacity: var(--background-opacity);
        }
      `
      : ''

    styleElement.innerHTML = injectedCss + backgroundCss
  }, [mode, theme_setting])

  return { ready: !!mode }
}
