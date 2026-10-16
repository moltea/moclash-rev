import type { ReactNode } from 'react'

import { FieldLegend, FieldSet } from '@ui/components/ui/field'
import { cn } from '@ui/lib/utils'

interface Props {
  label: ReactNode
  className?: string
  children?: ReactNode
}

export const BaseFieldset = ({ label, className, children }: Props) => {
  return (
    <FieldSet className={cn('rounded-lg border p-3', className)}>
      <FieldLegend variant="label">{label}</FieldLegend>
      {children}
    </FieldSet>
  )
}
