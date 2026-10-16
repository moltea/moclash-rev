import { ToggleGroup, ToggleGroupItem } from '@ui/components/ui/toggle-group'

interface Props {
  value?: string
  onChange?: (value: string) => void
}

const STACK_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'gvisor', label: 'gVisor' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'mips', label: 'Mips' },
]

export const StackModeSwitch = (props: Props) => {
  const { value, onChange } = props

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      value={value?.toLowerCase() ?? ''}
      onValueChange={(next) => {
        if (next) onChange?.(next)
      }}
    >
      {STACK_OPTIONS.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
