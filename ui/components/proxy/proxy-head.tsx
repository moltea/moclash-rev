import {
  EyeIcon,
  EyeOffIcon,
  GaugeIcon,
  LocateFixedIcon,
  SearchIcon,
  SearchXIcon,
  WifiIcon,
  WifiOffIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { HeadState } from '@/components/proxy/use-head-state'
import { useVerge } from '@/hooks/use-verge'
import delayManager from '@/services/delay'
import { showNotice } from '@/services/notice-service'
import { debugLog } from '@/utils/debug'
import { isValidLatencyTestUrl } from '@/utils/network'
import { BaseSearchBox } from '@ui/components/base'
import { cn } from '@ui/lib/utils'

import { ProxySortMenu, ProxyToolButton } from './proxy-group-tools'
import { ProxyTestUrlInput } from './proxy-test-url-input'

interface Props {
  className?: string
  url?: string
  groupName: string
  headState: HeadState
  onLocation: () => void
  onCheckDelay: () => void
  onHeadState: (val: Partial<HeadState>) => void
}

export const ProxyHead = ({
  className,
  url,
  groupName,
  headState,
  onHeadState,
  onLocation,
  onCheckDelay,
}: Props) => {
  const {
    showType,
    sortType,
    filterText,
    textState,
    testUrl,
    filterMatchCase,
    filterMatchWholeWord,
    filterUseRegularExpression,
  } = headState

  const { t } = useTranslation()
  const [autoFocus, setAutoFocus] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAutoFocus(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const { verge } = useVerge()
  const defaultLatencyUrl =
    verge?.default_latency_test?.trim() ||
    'http://cp.cloudflare.com/generate_204'

  useEffect(() => {
    delayManager.setUrl(
      groupName,
      testUrl?.trim() || url?.trim() || defaultLatencyUrl,
    )
  }, [groupName, testUrl, defaultLatencyUrl, url])

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <ProxyToolButton
        label={t('proxies.page.tooltips.locate')}
        onClick={onLocation}
      >
        <LocateFixedIcon />
      </ProxyToolButton>

      <ProxyToolButton
        label={t('proxies.page.tooltips.delayCheck')}
        onClick={() => {
          debugLog(`[ProxyHead] 点击延迟测试按钮，组: ${groupName}`)
          if (testUrl?.trim() && textState !== 'filter') {
            debugLog(`[ProxyHead] 使用自定义测试URL: ${testUrl}`)
            onHeadState({ textState: 'url' })
          }
          if (testUrl?.trim() && !isValidLatencyTestUrl(testUrl)) {
            showNotice.warning('proxies.feedback.warnings.invalidTestUrl')
            return
          }
          onCheckDelay()
        }}
      >
        <GaugeIcon />
      </ProxyToolButton>

      <ProxySortMenu
        sortType={sortType}
        onSort={(nextSortType) => onHeadState({ sortType: nextSortType })}
      />

      <ProxyToolButton
        label={t('proxies.page.tooltips.delayCheckUrl')}
        onClick={() =>
          onHeadState({ textState: textState === 'url' ? null : 'url' })
        }
      >
        {textState === 'url' ? <WifiIcon /> : <WifiOffIcon />}
      </ProxyToolButton>

      <ProxyToolButton
        label={
          showType
            ? t('proxies.page.tooltips.showBasic')
            : t('proxies.page.tooltips.showDetail')
        }
        onClick={() => onHeadState({ showType: !showType })}
      >
        {showType ? <EyeIcon /> : <EyeOffIcon />}
      </ProxyToolButton>

      <ProxyToolButton
        label={t('proxies.page.tooltips.filter')}
        onClick={() =>
          onHeadState({ textState: textState === 'filter' ? null : 'filter' })
        }
      >
        {textState === 'filter' ? <SearchXIcon /> : <SearchIcon />}
      </ProxyToolButton>

      {textState === 'filter' && (
        <div className="ml-1 min-w-0 flex-1">
          <BaseSearchBox
            autoFocus={autoFocus}
            value={filterText}
            searchState={{
              matchCase: filterMatchCase,
              matchWholeWord: filterMatchWholeWord,
              useRegularExpression: filterUseRegularExpression,
            }}
            onSearch={(_, state) =>
              onHeadState({
                filterText: state.text,
                filterMatchCase: state.matchCase,
                filterMatchWholeWord: state.matchWholeWord,
                filterUseRegularExpression: state.useRegularExpression,
              })
            }
          />
        </div>
      )}

      {textState === 'url' && (
        <ProxyTestUrlInput
          name={groupName}
          autoComplete="new-password"
          autoFocus={autoFocus}
          autoSave="off"
          value={testUrl}
          placeholder={t('proxies.page.placeholders.delayCheckUrl')}
          onCommit={(testUrl) => onHeadState({ testUrl })}
          className="ml-1 min-w-0 flex-1"
        />
      )}
    </div>
  )
}
