// Copyright © 2026 Mochi OÜ
// SPDX-License-Identifier: Apache-2.0

// Place data for checkin/travelling features

export interface PlaceData {
  name: string
  lat: number
  lon: number
  /** Place category for smart zoom (place, amenity, natural, etc.) */
  category?: string
}

export interface TravellingData {
  origin: PlaceData
  destination: PlaceData
}

export interface MemoryData {
  year: number
  years_ago: number
}

export interface RssData {
  title: string
  link: string
  html: string
  image?: string
}

export interface PostData {
  checkin?: PlaceData
  travelling?: TravellingData
  memory?: MemoryData
  rss?: RssData
}

// Photon API response types
export interface PhotonFeature {
  geometry: {
    coordinates: [number, number] // [lon, lat]
    type: 'Point'
  }
  properties: {
    osm_id: number
    osm_type: 'N' | 'W' | 'R'
    name?: string
    city?: string
    county?: string
    state?: string
    country?: string
    osm_key?: string
    osm_value?: string
  }
  type: 'Feature'
}

export interface PhotonResponse {
  features: PhotonFeature[]
  type: 'FeatureCollection'
}

export interface PhotonPlace {
  name: string
  displayName: string
  lat: number
  lon: number
  city?: string
  country?: string
  category?: string
  osmId?: string
}
