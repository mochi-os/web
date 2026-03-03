import * as React from 'react'
import { Flame, Sparkles, Star, Trophy, Clock } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

export type SortType = 'relevant' | 'ai' | 'interests' | 'new' | 'hot' | 'top'

interface SortOption {
  value: SortType
  label: string
  icon: React.ReactNode
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'ai', label: 'AI', icon: <Sparkles className="size-4" /> },
  { value: 'interests', label: 'Interests', icon: <Star className="size-4" /> },
  { value: 'new', label: 'New', icon: <Clock className="size-4" /> },
  { value: 'hot', label: 'Hot', icon: <Flame className="size-4" /> },
  { value: 'top', label: 'Top', icon: <Trophy className="size-4" /> },
]

interface SortSelectorProps {
  value: SortType
  onValueChange: (value: SortType) => void
  disabled?: boolean
  className?: string
}

export function SortSelector({
  value,
  onValueChange,
  disabled,
  className,
}: SortSelectorProps) {
  // Map legacy 'relevant' to 'interests' for display
  const effectiveValue = value === 'relevant' ? 'interests' : value
  const currentOption = SORT_OPTIONS.find((opt) => opt.value === effectiveValue) ?? SORT_OPTIONS[0]

  return (
    <Select
      value={effectiveValue}
      onValueChange={(v: string) => onValueChange(v as SortType)}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue>
          <div className="flex items-center gap-2">
            {currentOption?.icon}
            <span>{currentOption?.label}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.icon}
              <span>{option.label}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
