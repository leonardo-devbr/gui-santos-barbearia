'use client'

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { barbershop } from '@/data/barbershop'

const position: [number, number] = [...barbershop.coordinates]
const markerSvg = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42"><path d="M16 0C7.163 0 0 7.163 0 16c0 11 16 26 16 26s16-15 16-26C32 7.163 24.837 0 16 0z" fill="#D4A94E"/><circle cx="16" cy="16" r="6" fill="#141210"/></svg>',
)

const goldIcon = L.icon({
  iconUrl: `data:image/svg+xml;charset=UTF-8,${markerSvg}`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -38],
})

export function LocationMap() {
  return (
    <MapContainer
      center={position}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <Marker position={position} icon={goldIcon}>
        <Popup>
          <span className="font-medium">{barbershop.name}</span>
          <br />
          {barbershop.address.street}
        </Popup>
      </Marker>
    </MapContainer>
  )
}
