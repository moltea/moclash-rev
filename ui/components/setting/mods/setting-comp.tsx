import { ChevronRightIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import isAsyncFunction from '@/utils/is-async-function'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@ui/components/ui/item'
import { Spinner } from '@ui/components/ui/spinner'

interface ItemProps {
  label: ReactNode
  extra?: ReactNode
  children?: ReactNode
  secondary?: ReactNode
  onClick?: () => void | Promise<any>
}

export const SettingItem = ({
  label,
  extra,
  children,
  secondary,
  onClick,
}: ItemProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const content = (
    <ItemContent>
      <ItemTitle>
        <span>{label}</span>
        {extra}
      </ItemTitle>
      {secondary && (
        <ItemDescription className="line-clamp-none">
          {secondary}
        </ItemDescription>
      )}
    </ItemContent>
  )

  if (!onClick) {
    return (
      <Item size="sm">
        {content}
        {children && <ItemActions>{children}</ItemActions>}
      </Item>
    )
  }

  const handleClick = () => {
    if (isAsyncFunction(onClick)) {
      setIsLoading(true)
      onClick()!.finally(() => setIsLoading(false))
    } else {
      onClick()
    }
  }

  return (
    <Item
      size="sm"
      role="button"
      tabIndex={isLoading ? -1 : 0}
      aria-disabled={isLoading}
      className="cursor-pointer hover:bg-muted/50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {content}
      <ItemActions>
        {isLoading ? (
          <Spinner />
        ) : (
          <ChevronRightIcon className="size-4 text-muted-foreground rtl:rotate-180" />
        )}
      </ItemActions>
    </Item>
  )
}

export const SettingList = ({
  title,
  children,
}: {
  title: ReactNode
  children: ReactNode
}) => (
  <section className="flex flex-col gap-2">
    <h2 className="px-1 font-heading text-sm font-semibold">{title}</h2>
    <ItemGroup className="rounded-lg border bg-card">{children}</ItemGroup>
  </section>
)
