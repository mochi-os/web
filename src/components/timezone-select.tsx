import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

export function getTimezones(): string[] {
  try {
    return (
      (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
    )
  } catch {
    return []
  }
}

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

interface TimezoneSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TimezoneSelect({ value, onChange, disabled }: TimezoneSelectProps) {
  const [open, setOpen] = useState(false)
  const timezones = useMemo(() => getTimezones(), [])
  const browserTimezone = useMemo(() => getBrowserTimezone(), [])

  const formatTimezone = (tz: string) => tz.replace(/_/g, ' ')
  const displayValue =
    value === 'auto'
      ? `Auto (${formatTimezone(browserTimezone)})`
      : formatTimezone(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between'
          disabled={disabled}
        >
          <span className='truncate'>{displayValue}</span>
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[350px] p-0' align='start'>
        <Command>
          <CommandInput placeholder='Search time zone...' />
          <CommandList>
            <CommandEmpty>No time zone found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value='auto'
                onSelect={() => {
                  onChange('auto')
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4 shrink-0',
                    value === 'auto' ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className='truncate'>
                  Auto ({formatTimezone(browserTimezone)})
                </span>
              </CommandItem>
              {timezones.map((tz) => (
                <CommandItem
                  key={tz}
                  value={tz}
                  onSelect={() => {
                    onChange(tz)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === tz ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className='truncate'>{formatTimezone(tz)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
