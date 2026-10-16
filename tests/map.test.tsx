// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { LocationMap } from '@/components/location-map';
const mock = vi.hoisted(() => ({ click: null as null | ((e: { latlng: { lat: number; lng: number } }) => void), drag: null as null | (() => void), marker: vi.fn(), tile: vi.fn(), setView: vi.fn() }));
vi.mock('leaflet', () => ({
  map: () => {
    const map = { setView: mock.setView, on: (_: string, callback: typeof mock.click) => { mock.click = callback; return map; }, remove: vi.fn(), getBounds: () => ({ contains: () => false }), getZoom: () => 5 };
    mock.setView.mockReturnValue(map); return map;
  },
  tileLayer: mock.tile,
  marker: mock.marker,
  divIcon: (data: unknown) => data,
}));
beforeEach(() => {
  vi.stubGlobal('React', React); mock.marker.mockReset(); mock.tile.mockReset(); mock.setView.mockReset(); mock.click = null; mock.drag = null;
  const tiles = { on: () => tiles, addTo: () => tiles }; mock.tile.mockReturnValue(tiles);
  const marker = { addTo: () => marker, on: (_: string, callback: () => void) => { mock.drag = callback; }, getLatLng: () => ({ lat: -13.535, lng: -71.971 }), setLatLng: vi.fn(), remove: vi.fn() };
  mock.marker.mockReturnValue(marker);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('shows Peru without saving a default point, sends click/drag coordinates and identifies tile requests', async () => {
  const changed = vi.fn();
  const view = render(<LocationMap latitude={null} longitude={null} onChange={changed} />);
  await waitFor(() => expect(mock.tile).toHaveBeenCalledTimes(1));
  expect(mock.marker).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
  expect(mock.tile).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ referrerPolicy: 'strict-origin-when-cross-origin', attribution: expect.stringContaining('OpenStreetMap') }));
  mock.click!({ latlng: { lat: -13.53, lng: -71.97 } }); expect(changed).toHaveBeenCalledWith(-13.53, -71.97);
  view.rerender(<LocationMap latitude={-13.53} longitude={-71.97} onChange={changed} />);
  await waitFor(() => expect(mock.marker).toHaveBeenCalledTimes(1));
  mock.drag!(); expect(changed).toHaveBeenLastCalledWith(-13.535, -71.971);
});
