// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// Map display component using Leaflet

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Blue marker icon as inline SVG (origin/checkin)
const blueMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
  <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" fill="#3b82f6"/>
  <circle cx="12" cy="12" r="5" fill="white"/>
</svg>`

// Green marker icon as inline SVG (destination)
const greenMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
  <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" fill="#22c55e"/>
  <circle cx="12" cy="12" r="5" fill="white"/>
</svg>`

const blueMarkerIcon = L.divIcon({
  html: blueMarkerSvg,
  className: '',
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

const greenMarkerIcon = L.divIcon({
  html: greenMarkerSvg,
  className: '',
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
})

// Calculate curved arc points between two coordinates
// Uses great circle for long distances, quadratic bezier for short distances
// Returns { points, destLon } where destLon is the unwrapped destination longitude
// (may be outside -180 to 180 range when crossing date line)
function greatCircleArc(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  numPoints = 300
): { points: [number, number][]; destLon: number } {
  const toRad = (deg: number) => deg * Math.PI / 180
  const toDeg = (rad: number) => rad * 180 / Math.PI

  const φ1 = toRad(lat1)
  const λ1 = toRad(lon1)
  const φ2 = toRad(lat2)
  const λ2 = toRad(lon2)

  // Calculate angular distance (in radians, Earth's surface)
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
  ))

  // If points are very close, just return straight line
  if (d < 0.0001) {
    return { points: [[lat1, lon1], [lat2, lon2]], destLon: lon2 }
  }

  // For short distances (< ~500km), use a gentle quadratic bezier curve
  // This gives a visible arc even for nearby points
  const distanceKm = d * 6371 // Earth's radius in km
  if (distanceKm < 500) {
    // Calculate midpoint
    const midLat = (lat1 + lat2) / 2
    const midLon = (lon1 + lon2) / 2

    // Calculate offset magnitude (15% of the distance in degrees)
    const dx = lon2 - lon1
    const dy = lat2 - lat1
    const offsetMagnitude = Math.sqrt(dx * dx + dy * dy) * 0.15

    // Curve toward the pole to mimic great circle behavior:
    // - Northern hemisphere: curve north (positive lat offset)
    // - Southern hemisphere: curve south (negative lat offset)
    const poleDirection = midLat >= 0 ? 1 : -1
    const ctrlLat = midLat + offsetMagnitude * poleDirection
    const ctrlLon = midLon

    // Generate quadratic bezier curve
    const points: [number, number][] = []
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints
      const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * ctrlLat + t * t * lat2
      const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * ctrlLon + t * t * lon2
      points.push([lat, lon])
    }
    return { points, destLon: lon2 }
  }

  // For long distances, use great circle arc
  const points: [number, number][] = []
  let prevLon = lon1
  let finalLon = lon2
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2)
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2)
    const z = A * Math.sin(φ1) + B * Math.sin(φ2)
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))
    let lon = toDeg(Math.atan2(y, x))

    // Unwrap longitude to handle date line crossing
    // If longitude jumps by more than 180°, adjust it to continue smoothly
    while (lon - prevLon > 180) lon -= 360
    while (lon - prevLon < -180) lon += 360
    prevLon = lon

    // Track the final unwrapped longitude for marker/bounds placement
    if (i === numPoints) finalLon = lon

    points.push([lat, lon])
  }
  return { points, destLon: finalLon }
}

// Get smart zoom level based on place category
function getSmartZoom(category?: string): number {
  switch (category) {
    // Large areas - zoom out
    case 'place': // cities, towns, villages
    case 'boundary':
      return 11
    // Natural features - medium zoom
    case 'natural':
    case 'leisure': // parks, etc.
    case 'landuse':
      return 13
    // Specific venues - zoom in
    case 'amenity': // restaurants, cafes, etc.
    case 'shop':
    case 'tourism': // hotels, attractions
    case 'building':
      return 16
    // Default for unknown
    default:
      return 14
  }
}

export interface MapViewProps {
  lat: number
  lon: number
  name?: string
  zoom?: number
  /** Place category for smart zoom (place, amenity, natural, etc.) */
  category?: string
  /** Origin point for two-point display (e.g., current location for travelling) */
  origin?: { lat: number; lon: number; name?: string }
  /** Show user's current location as origin (uses geolocation API) */
  showCurrentLocation?: boolean
  /** @deprecated Use aspectRatio instead */
  height?: number
  /** Aspect ratio as "width/height", e.g. "2/1" for 2:1. Defaults to "2/1" */
  aspectRatio?: string
  interactive?: boolean
  className?: string
}

export function MapView({
  lat,
  lon,
  name,
  zoom,
  category,
  origin,
  showCurrentLocation = false,
  height,
  aspectRatio = '2/1',
  interactive = false,
  className = '',
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null)

  // Get current location if requested
  useEffect(() => {
    if (showCurrentLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          })
        },
        () => {
          // Geolocation failed or denied - silently ignore
        },
        { timeout: 5000, maximumAge: 60000 }
      )
    }
  }, [showCurrentLocation])

  // Determine the origin point (explicit origin or current location)
  // Use primitive values for stable dependencies
  const originLat = origin?.lat ?? (showCurrentLocation ? currentLocation?.lat : undefined)
  const originLon = origin?.lon ?? (showCurrentLocation ? currentLocation?.lon : undefined)
  const originName = origin?.name ?? (showCurrentLocation && currentLocation ? 'Current location' : undefined)
  const hasOrigin = originLat != null && originLon != null

  // Calculate effective zoom
  const effectiveZoom = zoom ?? getSmartZoom(category)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Create map
    const map = L.map(containerRef.current, {
      zoomControl: interactive,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      attributionControl: false,
    })

    // Add custom attribution control without Leaflet prefix
    L.control.attribution({ prefix: false }).addTo(map)

    // Add tile layer (CARTO Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map)

    // Style the attribution to be more subtle
    const attrib = map.getContainer().querySelector('.leaflet-control-attribution')
    if (attrib instanceof HTMLElement) {
      attrib.style.fontSize = '9px'
      attrib.style.opacity = '0.6'
      attrib.style.padding = '0 4px'
    }

    if (hasOrigin && originLat != null && originLon != null) {
      // Two-point display: show origin, destination, and line
      // Calculate arc first to get unwrapped destination longitude (for date line crossing)
      const { points: arcPoints, destLon } = greatCircleArc(originLat, originLon, lat, lon)

      // Add origin marker
      const originMarker = L.marker([originLat, originLon], { icon: blueMarkerIcon, interactive }).addTo(map)
      if (originName && interactive) {
        originMarker.bindPopup(originName)
      }

      // Add destination marker at unwrapped longitude (consistent with arc)
      const destMarker = L.marker([lat, destLon], { icon: greenMarkerIcon, interactive }).addTo(map)
      if (name && interactive) {
        destMarker.bindPopup(name)
      }

      // Draw great circle arc
      L.polyline(arcPoints, { color: '#3b82f6', weight: 2, opacity: 0.7, smoothFactor: 0 }).addTo(map)

      // Fit map to show both points (using unwrapped destination)
      const bounds = L.latLngBounds([
        [originLat, originLon],
        [lat, destLon],
      ])
      map.fitBounds(bounds, { padding: [30, 30] })
    } else {
      // Single point display
      const destMarker = L.marker([lat, lon], { icon: blueMarkerIcon, interactive }).addTo(map)
      if (name && interactive) {
        destMarker.bindPopup(name)
      }
      map.setView([lat, lon], effectiveZoom)
    }

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [lat, lon, effectiveZoom, name, interactive, hasOrigin, originLat, originLon, originName])

  // Update map when position changes (single point mode only)
  useEffect(() => {
    if (mapRef.current && !hasOrigin) {
      mapRef.current.setView([lat, lon], effectiveZoom)
    }
  }, [lat, lon, effectiveZoom, hasOrigin])

  return (
    <div
      ref={containerRef}
      className={`isolate rounded-[8px] overflow-hidden ${className}`}
      style={height ? { height, aspectRatio } : { aspectRatio, maxHeight: 150 }}
    />
  )
}
