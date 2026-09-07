// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { Building2, MapPin, Mountain } from 'lucide-react'

/** Glyph for a place by its category: terrain, a venue, or a plain pin. */
export function PlaceIcon({ category }: { category?: string }) {
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
