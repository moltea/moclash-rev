import { Trash2Icon } from 'lucide-react'
import { Fragment, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { parseHotkey } from '@/utils/parse-hotkey'
import { Button } from '@ui/components/ui/button'
import { Kbd } from '@ui/components/ui/kbd'

interface Props {
  value: string[]
  onChange: (value: string[]) => void
}

export const HotkeyInput = (props: Props) => {
  const { value, onChange } = props
  const { t } = useTranslation()

  const changeRef = useRef<string[]>([])
  const [keys, setKeys] = useState(value)

  return (
    <div className="flex items-center gap-1">
      <div className="relative min-h-7 w-56">
        <input
          className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
          onKeyUp={() => {
            const ret = changeRef.current.slice()
            if (ret.length) {
              onChange(ret)
              changeRef.current = []
            }
          }}
          onKeyDown={(e) => {
            e.preventDefault()
            e.stopPropagation()

            const key = parseHotkey(e)
            if (key === 'UNIDENTIFIED') return

            changeRef.current = [...new Set([...changeRef.current, key])]
            setKeys(changeRef.current)
          }}
        />

        <div className="flex size-full min-h-7 flex-wrap items-center gap-0.5 rounded-md border border-input bg-input/20 px-1 py-0.5 transition-colors peer-focus:border-ring peer-focus:ring-2 peer-focus:ring-ring/30 dark:bg-input/30">
          {keys.map((key, index) => (
            <Fragment key={key}>
              {index !== 0 && (
                <span className="px-0.5 text-xs text-muted-foreground">+</span>
              )}
              <Kbd className="text-foreground">{key}</Kbd>
            </Fragment>
          ))}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        title={t('shared.actions.delete')}
        aria-label={t('shared.actions.delete')}
        onClick={() => {
          onChange([])
          setKeys([])
        }}
      >
        <Trash2Icon />
      </Button>
    </div>
  )
}
