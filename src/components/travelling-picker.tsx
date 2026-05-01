// Travelling picker with origin and destination on the same screen

import { useState, useRef, useEffect } from 'react'
import { Trans } from '@lingui/react/macro'
import { MapPin, Mountain, Building2, Loader2, Plane, X } from 'lucide-react'
import { usePlaceSearch } from '../hooks/use-place-search'
import { MapView } from './map-view'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import type { PlaceData, PhotonPlace } from '../types/places'
import { t } from '@lingui/core/macro'

export interface TravellingPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (origin: PlaceData, destination: PlaceData) => void
  /** Initial origin value */
  initialOrigin?: PlaceData | null
  /** Initial destination value */
  initialDestination?: PlaceData | null
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

type ActiveField = 'origin' | 'destination' | null

export function TravellingPicker({
  open,
  onOpenChange,
  onSelect,
  initialOrigin: _initialOrigin,
  initialDestination: _initialDestination,
}: TravellingPickerProps) {
  const [originQuery, setOriginQuery] = useState('')
  const [destinationQuery, setDestinationQuery] = useState('')
  const [origin, setOrigin] = useState<PhotonPlace | null>(null)
  const [destination, setDestination] = useState<PhotonPlace | null>(null)
  const [activeField, setActiveField] = useState<ActiveField>('origin')

  const originInputRef = useRef<HTMLInputElement>(null)
  const destinationInputRef = useRef<HTMLInputElement>(null)

  const { places: originPlaces, isFetching: originFetching } = usePlaceSearch(originQuery, {
    enabled: activeField === 'origin',
  })
  const { places: destinationPlaces, isFetching: destinationFetching } = usePlaceSearch(destinationQuery, {
    enabled: activeField === 'destination',
  })

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setOriginQuery('')
      setDestinationQuery('')
      setOrigin(null)
      setDestination(null)
      setActiveField('origin')
    }
  }, [open])

  const handleOriginSelect = (place: PhotonPlace) => {
    setOrigin(place)
    setOriginQuery(place.name)
    setActiveField('destination')
    // Focus destination input after selecting origin
    setTimeout(() => destinationInputRef.current?.focus(), 0)
  }

  const handleDestinationSelect = (place: PhotonPlace) => {
    setDestination(place)
    setDestinationQuery(place.name)
    setActiveField(null)
  }

  const handleConfirm = () => {
    if (origin && destination) {
      onSelect(
        {
          name: origin.displayName,
          lat: origin.lat,
          lon: origin.lon,
          category: origin.category,
        },
        {
          name: destination.displayName,
          lat: destination.lat,
          lon: destination.lon,
          category: destination.category,
        }
      )
      onOpenChange(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  const clearOrigin = () => {
    setOrigin(null)
    setOriginQuery('')
    setActiveField('origin')
    setTimeout(() => originInputRef.current?.focus(), 0)
  }

  const clearDestination = () => {
    setDestination(null)
    setDestinationQuery('')
    setActiveField('destination')
    setTimeout(() => destinationInputRef.current?.focus(), 0)
  }

  const canConfirm = origin && destination

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            <Trans>Travelling</Trans>
          </DialogTitle>
          <DialogDescription className="sr-only"><Trans>Set origin and destination</Trans></DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0 px-1">
          {/* Origin field */}
          <div className="space-y-2">
            <Label><Trans>From</Trans></Label>
            <div className="relative">
              {origin ? (
                <div className="flex items-center gap-2 border rounded-[8px] px-3 py-2">
                  <PlaceIcon category={origin.category} />
                  <span className="flex-1 truncate">{origin.name}</span>
                  <button
                    type="button"
                    onClick={clearOrigin}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    ref={originInputRef}
                    value={originQuery}
                    onChange={(e) => {
                      setOriginQuery(e.target.value)
                      setActiveField('origin')
                    }}
                    onFocus={() => setActiveField('origin')}
                    placeholder={t`Search for origin...`}
                    autoFocus
                  />
                  {originFetching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </>
              )}
            </div>

            {/* Origin results */}
            {activeField === 'origin' && !origin && originPlaces.length > 0 && (
              <div className="max-h-40 overflow-y-auto border rounded-[8px] divide-y">
                {originPlaces.map((place, index) => (
                  <button
                    key={place.osmId || index}
                    type="button"
                    onClick={() => handleOriginSelect(place)}
                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-start gap-2"
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
          </div>

          {/* Destination field */}
          <div className="space-y-2">
            <Label>To</Label>
            <div className="relative">
              {destination ? (
                <div className="flex items-center gap-2 border rounded-[8px] px-3 py-2">
                  <PlaceIcon category={destination.category} />
                  <span className="flex-1 truncate">{destination.name}</span>
                  <button
                    type="button"
                    onClick={clearDestination}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    ref={destinationInputRef}
                    value={destinationQuery}
                    onChange={(e) => {
                      setDestinationQuery(e.target.value)
                      setActiveField('destination')
                    }}
                    onFocus={() => setActiveField('destination')}
                    placeholder={t`Search for destination...`}
                  />
                  {destinationFetching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </>
              )}
            </div>

            {/* Destination results */}
            {activeField === 'destination' && !destination && destinationPlaces.length > 0 && (
              <div className="max-h-40 overflow-y-auto border rounded-[8px] divide-y">
                {destinationPlaces.map((place, index) => (
                  <button
                    key={place.osmId || index}
                    type="button"
                    onClick={() => handleDestinationSelect(place)}
                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-start gap-2"
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
          </div>

          {/* Map preview when both are selected */}
          {origin && destination && (
            <div className="space-y-2">
              <MapView
                lat={destination.lat}
                lon={destination.lon}
                name={destination.name}
                origin={{
                  lat: origin.lat,
                  lon: origin.lon,
                  name: origin.name,
                }}
                height={180}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={!canConfirm}
            >
              <Trans>Confirm</Trans>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
