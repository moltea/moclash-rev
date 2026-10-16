import { useTranslation } from 'react-i18next'

import { ToggleGroup, ToggleGroupItem } from '@ui/components/ui/toggle-group'

type ThemeValue = IVergeConfig['theme_mode']

interface Props {
  value?: ThemeValue
  onChange?: (value: ThemeValue) => void
}

export const ThemeModeSwitch = (props: Props) => {
  const { value, onChange } = props
  const { t } = useTranslation()

  const modes = ['light', 'dark', 'system'] as const

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      value={value ?? ''}
    >
      {modes.map((mode) => (
        <ToggleGroupItem
          key={mode}
          value={mode}
          className="capitalize"
          onClick={() => onChange?.(mode)}
        >
          {t(`settings.sections.appearance.${mode}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
