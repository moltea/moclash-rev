import { useCallback, useEffect, useMemo, useRef } from 'react'

import { Button } from '@ui/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'

interface ProxyGroupNavigatorProps {
  proxyGroupNames: string[]
  onGroupLocation: (groupName: string) => void
  enableHoverJump?: boolean
  hoverDelay?: number
}

export const DEFAULT_HOVER_DELAY = 280

const getGroupDisplayChar = (groupName: string): string => {
  if (!groupName) return '?'

  const firstChar = Array.from(groupName)[0]
  return firstChar || '?'
}

export const ProxyGroupNavigator = ({
  proxyGroupNames,
  onGroupLocation,
  enableHoverJump = true,
  hoverDelay = DEFAULT_HOVER_DELAY,
}: ProxyGroupNavigatorProps) => {
  const lastHoveredRef = useRef<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hoverDelayMs = hoverDelay >= 0 ? hoverDelay : 0

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enableHoverJump) {
      clearHoverTimer()
      lastHoveredRef.current = null
    }
    return () => {
      clearHoverTimer()
    }
  }, [clearHoverTimer, enableHoverJump])

  const handleGroupClick = useCallback(
    (groupName: string) => {
      clearHoverTimer()
      lastHoveredRef.current = groupName
      onGroupLocation(groupName)
    },
    [clearHoverTimer, onGroupLocation],
  )

  const handleGroupHover = useCallback(
    (groupName: string) => {
      if (!enableHoverJump) return
      if (lastHoveredRef.current === groupName) return
      clearHoverTimer()
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null
        lastHoveredRef.current = groupName
        onGroupLocation(groupName)
      }, hoverDelayMs)
    },
    [clearHoverTimer, enableHoverJump, hoverDelayMs, onGroupLocation],
  )

  const handleButtonLeave = useCallback(() => {
    clearHoverTimer()
    lastHoveredRef.current = null
  }, [clearHoverTimer])

  const processedGroups = useMemo(() => {
    return proxyGroupNames
      .filter((name) => name && name.trim())
      .map((name) => ({
        name,
        displayChar: getGroupDisplayChar(name),
      }))
  }, [proxyGroupNames])

  if (processedGroups.length === 0) {
    return null
  }

  return (
    <div className="flex h-full w-8 shrink-0 flex-col overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="my-auto flex flex-col items-center gap-0.5">
        {processedGroups.map(({ name, displayChar }) => (
          <Tooltip key={name}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-xs font-semibold text-muted-foreground"
                onClick={() => handleGroupClick(name)}
                onMouseEnter={() => handleGroupHover(name)}
                onFocus={() => handleGroupHover(name)}
                onMouseLeave={handleButtonLeave}
                onBlur={handleButtonLeave}
              >
                {displayChar}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">{name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
