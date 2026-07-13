// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Place picker with search and map preview

import { useState } from 'react'
import { Trans } from '@lingui/react/macro'
import { MapPin, Mountain, Building2, Loader2, Check } from 'lucide-react'
import { usePlaceSearch } from '../hooks/use-place-search'
import { MapView } from './map-view'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import type { PlaceData, PhotonPlace } from '../types/places'

export interface PlacePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (place: PlaceData) => void
  title?: string
  placeholder?: string
}

// Get icon based on place category
function PlaceIcon({ category }: { category?: string }) {
  switch (category) {
    case 'natural':
      return <Mountain className="h-4 w-4 text-green-600" />
    case 'amenity':
    case 'shop':
    case 'tourism':
      return <Building2 className="h-4 w-4 text-blue-600" />
    default:
      return <MapPin className="h-4 w-4 text-red-600" />
  }
}

export function PlacePicker({
  open,
  onOpenChange,
  onSelect,
  title = 'Select location',
  placeholder = 'Search for a place...',
}: PlacePickerProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PhotonPlace | null>(null)
  const { places, isLoading, isFetching } = usePlaceSearch(query)

  const handleSelect = (place: PhotonPlace) => {
    setSelected(place)
  }

  const handleConfirm = () => {
    if (selected) {
      // Clear local state first
      setQuery('')
      setSelected(null)
      // Call onSelect - parent controls whether to close or open another picker
      onSelect({
        name: selected.displayName,
        lat: selected.lat,
        lon: selected.lon,
        category: selected.category,
      })
    }
  }

  const handleClose = () => {
    setQuery('')
    setSelected(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only"><Trans>Search for a place</Trans></DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 p-1">
          {/* Search input */}
          <div className="relative">
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelected(null)
              }}
              placeholder={placeholder}
              autoFocus
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Results list */}
          {!selected && places.length > 0 && (
            <div className="max-h-60 overflow-y-auto border rounded-[8px] divide-y">
              {places.map((place, index) => (
                <button
                  key={place.osmId || index}
                  type="button"
                  onClick={() => handleSelect(place)}
                  className="w-full px-3 py-2 text-start hover:bg-hover transition-colors flex items-start gap-2"
                >
                  <PlaceIcon category={place.category} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{place.name}</div>
                    {place.displayName !== place.name && (
                      <div className="text-sm text-muted-foreground truncate">
                        {place.displayName}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No results */}
          {!selected && !isLoading && query.length >= 2 && places.length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              <Trans>No places found</Trans>
            </div>
          )}

          {/* Selected place with map */}
          {selected && (
            <div className="space-y-3">
              <MapView
                lat={selected.lat}
                lon={selected.lon}
                name={selected.name}
                height={180}
              />
              <div className="flex items-center gap-2">
                <PlaceIcon category={selected.category} />
                <span className="font-medium">{selected.displayName}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelected(null)}
                >
                  <Trans>Back</Trans>
                </Button>
                <Button className="flex-1" onClick={handleConfirm}>
                  <Check className="size-4" />
                  <Trans>Confirm</Trans>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
