"use client";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useRef, useState } from 'react';
import { clientApi } from '@/lib/client-api';

export type SelectedLocation = { id: number; label: string; latitude: number; longitude: number; type: string; address: string; city: string };
export function LocationSearch({ onSelect }: { onSelect: (place: SelectedLocation) => void }) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<SelectedLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  async function search() {
    if (busy || query.trim().length < 3) return;
    const current = ++generation.current;
    setBusy(true); setMessage(''); setPlaces([]);
    try {
      const result = await clientApi<{ places: SelectedLocation[] }>(`/api/locations/search?q=${encodeURIComponent(query.trim())}`);
      if (current === generation.current) {
        setPlaces(result.places);
        if (!result.places.length) setMessage('Sin resultados. Completa la ubicación manualmente.');
      }
    } catch (error) { if (current === generation.current) setMessage((error as Error).message); }
    finally { if (current === generation.current) setBusy(false); }
  }
  return <div className="field-group">
    <label htmlFor="venue-search">Busca un local o dirección de Perú</label>
    <div className="actions"><Input id="venue-search" value={query} maxLength={160} onChange={e => {
      setQuery(e.target.value); setPlaces([]); generation.current++; setBusy(false);
    }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} placeholder="Ej. Parque Huamanmarca, Huancayo" autoComplete="off" />
      <Button className="button button-secondary" type="button" disabled={busy || query.trim().length < 3} onClick={search}>{busy ? 'Buscando…' : 'Buscar'}</Button></div>
    <p className="field-help">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>. Búsqueda con Nominatim.</p>
    {message && <p role="status" className="field-help">{message}</p>}
    {places.length > 0 && <ul className="location-results">{places.map(place => <li key={place.id}>
      <Button className="button button-secondary" type="button" onClick={() => { onSelect(place); setQuery(place.label); setPlaces([]); }}>{place.label}</Button>
    </li>)}</ul>}
  </div>;
}
