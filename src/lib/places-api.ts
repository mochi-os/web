// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

// Photon geocoding API client
// https://photon.komoot.io/

import type { PhotonResponse, PhotonPlace, PhotonFeature } from '../types/places'

const PHOTON_URL = 'https://photon.komoot.io/api'

// Build display name from Photon properties
function buildDisplayName(props: PhotonFeature['properties']): string {
  const parts: string[] = []
  if (props.name) parts.push(props.name)
  if (props.city && props.city !== props.name) parts.push(props.city)
  if (props.state) parts.push(props.state)
  if (props.country) parts.push(props.country)
  return parts.join(', ')
}

// Convert Photon feature to our place format
function featureToPlace(feature: PhotonFeature): PhotonPlace {
  const props = feature.properties
  const [lon, lat] = feature.geometry.coordinates

  return {
    name: props.name || buildDisplayName(props),
    displayName: buildDisplayName(props),
    lat,
    lon,
    city: props.city,
    country: props.country,
    category: props.osm_key,
    osmId: props.osm_type && props.osm_id ? `${props.osm_type}${props.osm_id}` : undefined,
  }
}

// Search for places by query string
export async function searchPlaces(query: string, limit = 10): Promise<PhotonPlace[]> {
  if (!query || query.trim().length < 2) {
    return []
  }

  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(limit),
  })

  const response = await fetch(`${PHOTON_URL}?${params}`)
  if (!response.ok) {
    throw new Error(`Photon API error: ${response.status}`)
  }

  const data: PhotonResponse = await response.json()
  return data.features.map(featureToPlace)
}
