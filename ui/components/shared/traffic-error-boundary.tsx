import { BugIcon, CircleAlertIcon, RefreshCwIcon } from 'lucide-react'
import { Component, type ErrorInfo, type FC, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@ui/components/ui/alert'
import { Button } from '@ui/components/ui/button'
import { Collapsible, CollapsibleContent } from '@ui/components/ui/collapsible'

interface Props {
  children: ReactNode
  fallbackComponent?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
}

export class TrafficErrorBoundary extends Component<Props, State> {
  private retryCount = 0
  private maxRetries = 3

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[TrafficErrorBoundary] 捕获到组件错误:', error, errorInfo)

    this.setState({
      error,
      errorInfo,
    })

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    this.reportError(error, errorInfo)
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    console.error('[TrafficErrorBoundary] 错误报告:', errorReport)
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      console.log(
        `[TrafficErrorBoundary] 尝试重试 (${this.retryCount}/${this.maxRetries})`,
      )

      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        showDetails: false,
      })
    } else {
      console.warn('[TrafficErrorBoundary] 已达到最大重试次数')
    }
  }

  private handleRefresh = () => {
    window.location.reload()
  }

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }))
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent
      }

      return (
        <TrafficErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          showDetails={this.state.showDetails}
          canRetry={this.retryCount < this.maxRetries}
          retryCount={this.retryCount}
          maxRetries={this.maxRetries}
          onRetry={this.handleRetry}
          onRefresh={this.handleRefresh}
          onToggleDetails={this.toggleDetails}
        />
      )
    }

    return this.props.children
  }
}

interface TrafficErrorFallbackProps {
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
  canRetry: boolean
  retryCount: number
  maxRetries: number
  onRetry: () => void
  onRefresh: () => void
  onToggleDetails: () => void
}

const TrafficErrorFallback: FC<TrafficErrorFallbackProps> = ({
  error,
  errorInfo,
  showDetails,
  canRetry,
  retryCount,
  maxRetries,
  onRetry,
  onRefresh,
  onToggleDetails,
}) => {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-50 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive bg-destructive/10 p-4">
      <CircleAlertIcon className="size-12 text-destructive" />

      <div className="text-sm font-medium">
        {t('shared.feedback.errors.trafficStats')}
      </div>

      <div className="text-center text-xs text-muted-foreground">
        {t('shared.feedback.errors.trafficStatsDescription')}
      </div>

      <Alert variant="destructive" className="max-w-100">
        <CircleAlertIcon />
        <AlertDescription className="flex flex-col gap-1">
          <span>
            <strong>{t('shared.feedback.errors.label')}:</strong>{' '}
            {error instanceof Error
              ? error.message
              : t('shared.feedback.errors.unknown')}
          </span>
          {retryCount > 0 && (
            <span className="text-[0.625rem]">
              {t('shared.labels.retryAttempts')}: {retryCount}/{maxRetries}
            </span>
          )}
        </AlertDescription>
      </Alert>

      <div className="flex gap-2">
        {canRetry && (
          <Button size="sm" onClick={onRetry}>
            <RefreshCwIcon data-icon="inline-start" />
            {t('shared.actions.retry')}
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onRefresh}>
          {t('shared.actions.refreshPage')}
        </Button>

        <Button variant="ghost" size="sm" onClick={onToggleDetails}>
          <BugIcon data-icon="inline-start" />
          {showDetails
            ? t('shared.actions.hideDetails')
            : t('shared.actions.showDetails')}
        </Button>
      </div>

      <Collapsible open={showDetails} className="w-full max-w-150">
        <CollapsibleContent className="flex flex-col gap-2 rounded-md border bg-card p-4">
          <div className="text-xs font-medium">
            {t('shared.feedback.errors.details')}:
          </div>
          <pre className="font-mono text-xs break-words whitespace-pre-wrap text-muted-foreground">
            {error?.stack}
          </pre>

          {errorInfo?.componentStack && (
            <>
              <div className="mt-2 text-xs font-medium">
                {t('shared.feedback.errors.componentStack')}:
              </div>
              <pre className="font-mono text-xs break-words whitespace-pre-wrap text-muted-foreground">
                {errorInfo.componentStack}
              </pre>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export const LightweightTrafficErrorBoundary: FC<{
  children: ReactNode
}> = ({ children }) => {
  const { t } = useTranslation()

  return (
    <TrafficErrorBoundary
      fallbackComponent={
        <div className="flex min-h-15 items-center justify-center gap-1 rounded-md bg-destructive/10 p-1 text-destructive">
          <CircleAlertIcon className="size-5" />
          <span className="text-xs">
            {t('shared.feedback.errors.trafficUnavailable')}
          </span>
        </div>
      }
    >
      {children}
    </TrafficErrorBoundary>
  )
}
