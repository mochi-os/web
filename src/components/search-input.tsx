import { Search as SearchIcon, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { Input } from './ui/input'

type SearchInputProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange'
> & {
  value: string
  onValueChange: (value: string) => void
  // Accessible label for the clear button. Defaults to a generic English
  // string; pass a localized value from callers that use i18n.
  clearLabel?: string
}

// A text input with a leading search icon and a trailing clear (X) button that
// appears once there is a value. Keeps search fields consistent across dialogs.
export function SearchInput({
  value,
  onValueChange,
  clearLabel = 'Clear search',
  className,
  ...props
}: SearchInputProps) {
  return (
    <div className='relative'>
      <SearchIcon className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2' />
      <Input
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn('ps-8', value && 'pe-8', className)}
        {...props}
      />
      {value && (
        <button
          type='button'
          aria-label={clearLabel}
          onClick={() => onValueChange('')}
          className='text-muted-foreground hover:text-foreground absolute end-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm transition-colors'
        >
          <X className='size-4' />
        </button>
      )}
    </div>
  )
}
