import { Rule } from 'tauri-plugin-mihomo-api'

import { Badge } from '@ui/components/ui/badge'
import { cn } from '@ui/lib/utils'

const COLOR = [
  'text-primary',
  'text-muted-foreground',
  'text-info',
  'text-warning',
  'text-success',
]

interface Props {
  value: Rule & { lineNo: number }
}

const parseColor = (text: string) => {
  if (text === 'REJECT' || text === 'REJECT-DROP') return 'text-destructive'
  if (text === 'DIRECT') return 'text-foreground'

  let sum = 0
  for (let i = 0; i < text.length; i++) {
    sum += text.charCodeAt(i)
  }
  return COLOR[sum % COLOR.length]
}

const RuleItem = (props: Props) => {
  const { value } = props

  return (
    <div className="flex items-start gap-3 border-b px-4 py-1.5 text-xs">
      <span className="w-8 shrink-0 pt-px text-center text-muted-foreground tabular-nums">
        {value.lineNo}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1 select-text">
        <div className="font-medium break-all">{value.payload || '-'}</div>

        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline" className="min-w-0 text-muted-foreground">
            {typeof value.type === 'string' ? value.type : value.type.Unknown}
          </Badge>

          <span className={cn('truncate', parseColor(value.proxy))}>
            {value.proxy}
          </span>
        </div>
      </div>
    </div>
  )
}

export default RuleItem
