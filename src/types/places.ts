// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Place data for checkin/travelling features

import type { Quote } from '../components/quote-card'

export interface PlaceData {
  name: string
  lat: number
  lon: number
  /** Place category for smart zoom (place, amenity, natural, etc.) */
  category?: string
}

export interface PostData {
  checkin?: PlaceData
  travelling?: { origin: PlaceData; destination: PlaceData }
  memory?: { year: number; years_ago: number }
  rss?: {
    title: string
    link: string
    html: string
    image?: string
    // Who boosted the post, where it arrived as a boost.
    shared?: string
  }
  // The post on another network the post's first link quotes.
  quote?: Quote
  // A poll: its options with their counts, whether several may be chosen,
  // when it closes (0 for never) and how many have voted.
  poll?: PostPoll
  // For a post from another network: its author and, for a boost, who boosted
  // it; its media by their addresses there; the custom emoji its text names.
  person?: PostPerson
  boost?: PostPerson
  media?: PostMedia[]
  emoji?: PostEmoji[]
}

export interface PostPoll {
  options: { name: string; votes: number }[]
  multiple: boolean
  expires: number
  voters: number
}

export interface PostPerson {
  id?: string
  name?: string
  address?: string
  page?: string
  avatar?: string
}

export interface PostMedia {
  url: string
  type: 'image' | 'video' | 'audio' | 'file'
  name?: string
  blurhash?: string
  width?: number
  height?: number
}

export interface PostEmoji {
  name: string
  url: string
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
