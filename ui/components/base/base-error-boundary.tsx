import { TriangleAlertIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@ui/components/ui/alert'

function ErrorFallback({ error }: FallbackProps) {
  const { t } = useTranslation()
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  return (
    <div role="alert" className="p-4">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>{t('shared.feedback.errors.unexpected')}</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <pre className="whitespace-pre-wrap break-all">{errorMessage}</pre>
          <details>
            <summary className="cursor-pointer">
              {t('shared.feedback.errors.stack')}
            </summary>
            <pre className="whitespace-pre-wrap break-all">{errorStack}</pre>
          </details>
        </AlertDescription>
      </Alert>
    </div>
  )
}

interface Props {
  children?: ReactNode
}

export const BaseErrorBoundary = ({ children }: Props) => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
  )
}
