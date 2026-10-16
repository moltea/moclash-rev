import { InboxIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { TranslationKey } from '@/types/generated/i18n-keys'
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@ui/components/ui/empty'
import { cn } from '@ui/lib/utils'

interface Props {
  text?: ReactNode
  textKey?: TranslationKey
  extra?: ReactNode
  className?: string
}

export const BaseEmpty = ({
  text,
  textKey = 'shared.statuses.empty',
  extra,
  className,
}: Props) => {
  const { t } = useTranslation()

  return (
    <Empty className={cn('size-full', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>{text !== undefined ? text : t(textKey)}</EmptyTitle>
      </EmptyHeader>
      {extra && <EmptyContent>{extra}</EmptyContent>}
    </Empty>
  )
}
