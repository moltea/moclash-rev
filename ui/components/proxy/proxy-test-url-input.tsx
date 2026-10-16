import {
  type ComponentProps,
  type Ref,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react'

import { useProfiles } from '@/hooks/use-profiles'
import { Input } from '@ui/components/ui/input'

type Props = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  inputRef?: Ref<HTMLInputElement>
  onCommit: (url: string) => void
}

export const ProxyTestUrlInput = ({ value, name, ...props }: Props) => {
  const { profiles } = useProfiles()
  return (
    <DraftTestUrlInput
      key={JSON.stringify([profiles?.current, name])}
      name={name}
      value={value}
      {...props}
    />
  )
}

const DraftTestUrlInput = ({ value, onCommit, inputRef, ...props }: Props) => {
  const [draft, setDraft] = useState<string | null>(null)
  const pendingRef = useRef<string | null>(null)
  const commitOnUnmount = useEffectEvent(() => {
    if (pendingRef.current !== null && pendingRef.current !== value)
      onCommit(pendingRef.current)
  })
  useEffect(() => () => commitOnUnmount(), [])

  return (
    <Input
      {...props}
      ref={inputRef}
      value={draft ?? value}
      onChange={(event) => {
        pendingRef.current = event.target.value
        setDraft(event.target.value)
      }}
      onBlur={() => {
        const next = pendingRef.current
        pendingRef.current = null
        setDraft(null)
        if (next !== null && next !== value) onCommit(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          const input = event.target as HTMLInputElement
          input.blur()
        }
      }}
    />
  )
}
