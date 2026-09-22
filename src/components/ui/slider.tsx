// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '../../lib/utils'

// The range and thumb paint with `--primary`, so a caller can recolour one
// slider by setting that variable in `style`.
//
// Radix puts role="slider" on the thumb, not the root, so the accessible name
// is forwarded to every thumb rather than left on a root nothing announces.
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min],
    [value, defaultValue, min]
  )

  return (
    <SliderPrimitive.Root
      data-slot='slider'
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        'relative flex w-full touch-none items-center py-1.5 select-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot='slider-track'
        className='bg-muted relative h-1.5 w-full grow overflow-hidden rounded-full'
      >
        <SliderPrimitive.Range
          data-slot='slider-range'
          className='bg-primary absolute h-full'
        />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          data-slot='slider-thumb'
          key={index}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className='border-primary ring-ring/50 block size-4 shrink-0 cursor-pointer rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden data-[disabled]:pointer-events-none'
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
