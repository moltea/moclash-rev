import {
  CaseSensitiveIcon,
  RegexIcon,
  SearchIcon,
  WholeWordIcon,
  XIcon,
} from 'lucide-react'
import {
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { buildRegex, compileStringMatcher } from '@/utils/search-matcher'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@ui/components/ui/input-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'
import { cn } from '@ui/lib/utils'

export type SearchState = {
  text: string
  matchCase: boolean
  matchWholeWord: boolean
  useRegularExpression: boolean
}

type SearchOptionState = Omit<SearchState, 'text'>

type SearchProps = {
  inputRef?: React.RefObject<HTMLInputElement | null>
  value?: string
  defaultValue?: string
  autoFocus?: boolean
  placeholder?: string
  className?: string
  matchCase?: boolean
  matchWholeWord?: boolean
  useRegularExpression?: boolean
  searchState?: Partial<SearchOptionState>
  onSearch: (match: (content: string) => boolean, state: SearchState) => void
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
}

const useControllableState = <T,>(options: {
  controlled: T | undefined
  defaultValue: T
}) => {
  const { controlled, defaultValue } = options
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const isControlled = controlled !== undefined
  const value = isControlled ? controlled : uncontrolled
  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next)
    },
    [isControlled],
  )

  return [value, setValue] as const
}

const OptionButton = ({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: ReactNode
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <InputGroupButton
        size="icon-xs"
        aria-label={label}
        aria-pressed={active}
        className={cn(active && 'bg-muted text-foreground')}
        onClick={onClick}
      >
        {children}
      </InputGroupButton>
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

export const BaseSearchBox = ({
  inputRef,
  value,
  defaultValue,
  autoFocus,
  placeholder,
  className,
  searchState,
  matchCase: defaultMatchCase = false,
  matchWholeWord: defaultMatchWholeWord = false,
  useRegularExpression: defaultUseRegularExpression = false,
  onSearch,
  onClick,
}: SearchProps) => {
  const { t } = useTranslation()
  const onSearchRef = useRef(onSearch)
  const lastSearchStateRef = useRef<SearchState | null>({
    text: value ?? defaultValue ?? '',
    matchCase: searchState?.matchCase ?? defaultMatchCase,
    matchWholeWord: searchState?.matchWholeWord ?? defaultMatchWholeWord,
    useRegularExpression:
      searchState?.useRegularExpression ?? defaultUseRegularExpression,
  })

  const [text, setText] = useControllableState<string>({
    controlled: value,
    defaultValue: defaultValue ?? '',
  })
  const [matchCase, setMatchCase] = useControllableState<boolean>({
    controlled: searchState?.matchCase,
    defaultValue: defaultMatchCase,
  })
  const [matchWholeWord, setMatchWholeWord] = useControllableState<boolean>({
    controlled: searchState?.matchWholeWord,
    defaultValue: defaultMatchWholeWord,
  })
  const [useRegularExpression, setUseRegularExpression] =
    useControllableState<boolean>({
      controlled: searchState?.useRegularExpression,
      defaultValue: defaultUseRegularExpression,
    })

  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  const emitSearch = useCallback((nextState: SearchState) => {
    const prevState = lastSearchStateRef.current
    const isSameState =
      !!prevState &&
      prevState.text === nextState.text &&
      prevState.matchCase === nextState.matchCase &&
      prevState.matchWholeWord === nextState.matchWholeWord &&
      prevState.useRegularExpression === nextState.useRegularExpression

    if (isSameState) return

    const compiled = compileStringMatcher(nextState.text, nextState)
    onSearchRef.current(compiled.matcher, nextState)
    lastSearchStateRef.current = nextState
  }, [])

  useEffect(() => {
    emitSearch({ text, matchCase, matchWholeWord, useRegularExpression })
  }, [emitSearch, matchCase, matchWholeWord, text, useRegularExpression])

  const errorMessage = useMemo(() => {
    if (!useRegularExpression || !text) return ''
    const flags = matchCase ? '' : 'i'
    return buildRegex(text, flags) ? '' : t('shared.validation.invalidRegex')
  }, [matchCase, t, text, useRegularExpression])

  const handleChangeText = (e: ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target?.value ?? ''
    setText(nextText)
    emitSearch({
      text: nextText,
      matchCase,
      matchWholeWord,
      useRegularExpression,
    })
  }

  const handleClearInput = () => {
    setText('')
    emitSearch({ text: '', matchCase, matchWholeWord, useRegularExpression })
  }

  const handleToggleMatchCase = () => {
    const next = !matchCase
    setMatchCase(next)
    emitSearch({ text, matchCase: next, matchWholeWord, useRegularExpression })
  }

  const handleToggleMatchWholeWord = () => {
    const next = !matchWholeWord
    setMatchWholeWord(next)
    emitSearch({ text, matchCase, matchWholeWord: next, useRegularExpression })
  }

  const handleToggleUseRegularExpression = () => {
    const next = !useRegularExpression
    setUseRegularExpression(next)
    emitSearch({
      text,
      matchCase,
      matchWholeWord,
      useRegularExpression: next,
    })
  }

  return (
    <Tooltip open={errorMessage ? undefined : false}>
      <TooltipTrigger asChild>
        <InputGroup className={cn('min-w-0', className)} onClick={onClick}>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            autoComplete="off"
            autoFocus={autoFocus}
            spellCheck={false}
            placeholder={placeholder ?? t('shared.placeholders.filter')}
            value={text}
            aria-invalid={!!errorMessage}
            onChange={handleChangeText}
          />
          <InputGroupAddon align="inline-end" className="gap-0.5">
            {!!text && (
              <OptionButton
                label={t('shared.placeholders.resetInput')}
                active={false}
                onClick={handleClearInput}
              >
                <XIcon />
              </OptionButton>
            )}
            <OptionButton
              label={t('shared.placeholders.matchCase')}
              active={matchCase}
              onClick={handleToggleMatchCase}
            >
              <CaseSensitiveIcon />
            </OptionButton>
            <OptionButton
              label={t('shared.placeholders.matchWholeWord')}
              active={matchWholeWord}
              onClick={handleToggleMatchWholeWord}
            >
              <WholeWordIcon />
            </OptionButton>
            <OptionButton
              label={t('shared.placeholders.useRegex')}
              active={useRegularExpression}
              onClick={handleToggleUseRegularExpression}
            >
              <RegexIcon />
            </OptionButton>
          </InputGroupAddon>
        </InputGroup>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start">
        {errorMessage}
      </TooltipContent>
    </Tooltip>
  )
}
