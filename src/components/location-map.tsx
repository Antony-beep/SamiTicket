'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function LocationMap({ latitude, longitude, onChange }: { latitude: number | null; longitude: number | null; onChange?: (latitude: number, longitude: number) => void }) {
  const container = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null), marker = useRef<Marker | null>(null);
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; }, [onChange]);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const editable = Boolean(onChange);
  useEffect(() => {
    let disposed = false;
    void import('leaflet').then(L => {
      if (disposed || !container.current) return;
      const instance = L.map(container.current, { scrollWheelZoom: false }).setView([-9.19, -75.015], 5);
      map.current = instance;
      L.tileLayer(process.env.NEXT_PUBLIC_OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' })
        .on('tileerror', () => { if (!disposed) setError('El mapa no pudo cargar. Conserva las coordenadas o ingrésalas manualmente.'); }).addTo(instance);
      if (editable) instance.on('click', e => callback.current?.(e.latlng.lat, e.latlng.lng));
      setReady(true);
    }).catch(() => { if (!disposed) setError('Mapa no disponible. Usa las coordenadas manuales.'); });
    return () => { disposed = true; map.current?.remove(); map.current = null; marker.current = null; };
  }, [editable]);
  useEffect(() => {
    if (!ready || !map.current) return;
    let disposed = false;
    void import('leaflet').then(L => {
      const instance = map.current;
      if (disposed || !instance) return;
      if (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) { marker.current?.remove(); marker.current = null; return; }
      if (marker.current) marker.current.setLatLng([latitude, longitude]);
      else {
        marker.current = L.marker([latitude, longitude], { draggable: editable, title: 'Entrada del evento', keyboard: true,
          icon: L.divIcon({ className: 'event-pin', html: '<span></span>', iconSize: [28, 38], iconAnchor: [14, 38] }) }).addTo(instance);
        marker.current.on('dragend', () => { const point = marker.current?.getLatLng(); if (point) callback.current?.(point.lat, point.lng); });
      }
      if (!instance.getBounds().contains([latitude, longitude]) || instance.getZoom() < 14) instance.setView([latitude, longitude], 16);
    });
    return () => { disposed = true; };
  }, [latitude, longitude, ready, editable]);
  return <div className="map-section"><div className="location-map" ref={container} aria-label={editable ? 'Mapa: toca para marcar la entrada; también puedes usar las coordenadas manuales' : 'Ubicación del evento'} />
    {editable && <p className="field-help">Toca el mapa o arrastra el pin hasta la entrada. También puedes editar las coordenadas con el teclado.</p>}
    {error && <p role="status" className="field-help">{error}</p>}
    <a className="field-help text-link" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Reportar un problema del mapa</a>
  </div>;
}
