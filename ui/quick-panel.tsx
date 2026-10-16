import './styles/globals.css'

import { ComposeContextProvider } from 'foxact/compose-context-provider'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { SWRConfig } from 'swr'

import { AppDataProvider } from '@/providers/app-data-provider'
import { WindowProvider } from '@/providers/window'
import { FALLBACK_LANGUAGE, initializeLanguage } from '@/services/i18n'
import {
  getPreloadConfig,
  preloadAppData,
  resolveThemeMode,
} from '@/services/preload'
import { swrConfig } from '@/services/query-client'
import { ThemeModeProvider } from '@/services/states'
import { AppStoreProvider } from '@/store/app-store'
import { disableWebViewShortcuts } from '@/utils/disable-webview-shortcuts'
import getSystem from '@/utils/get-system'
import { BaseErrorBoundary } from '@ui/components/base'
import { QuickPanel } from '@ui/components/quick-panel/quick-panel'

const container = document.getElementById('root')

if (!container) {
  throw new Error("No container 'root' found to render quick panel")
}

disableWebViewShortcuts()

if (getSystem() === 'macos') {
  document.body.classList.add('bg-transparent')
}

const render = (initialThemeMode: 'light' | 'dark') => {
  document.documentElement.classList.toggle('dark', initialThemeMode === 'dark')

  const contexts = [
    <ThemeModeProvider key="theme" initialState={initialThemeMode} />,
    <AppStoreProvider key="app-store" />,
  ]

  createRoot(container).render(
    <React.StrictMode>
      <ComposeContextProvider contexts={contexts}>
        <BaseErrorBoundary>
          <SWRConfig value={swrConfig}>
            <WindowProvider>
              <AppDataProvider>
                <QuickPanel />
              </AppDataProvider>
            </WindowProvider>
          </SWRConfig>
        </BaseErrorBoundary>
      </ComposeContextProvider>
    </React.StrictMode>,
  )
}

preloadAppData()
  .then(({ initialThemeMode }) => render(initialThemeMode))
  .catch((error) => {
    console.error('[quick-panel] bootstrap failed:', error)
    initializeLanguage(FALLBACK_LANGUAGE)
      .catch((fallbackError) => {
        console.error(
          '[quick-panel] fallback language initialization failed:',
          fallbackError,
        )
      })
      .finally(() => render(resolveThemeMode(getPreloadConfig())))
  })
