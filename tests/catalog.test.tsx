// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EventCatalog } from '@/components/event-catalog';
import type { Event } from '@/lib/events';

const base: Event = { id: 'one', slug: 'huaylarsh', title: 'Huaylarsh en vivo', description: '', date: '2099-11-25', startTime: '20:00', venue: 'Coliseo Wanka', address: '', city: 'Huancayo', latitude: -12, longitude: -75, category: 'Danzas', outdoor: false, priceCents: 2500, capacity: 100, available: 30, status: 'published', reference: '', coverSmallUrl: null, coverLargeUrl: null };
beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('filters real events by title or city, tolerating accents, and can clear an empty result', () => {
  render(<EventCatalog events={[base, { ...base, id: 'two', slug: 'jazz', title: 'Jazz de noche', city: 'Junín' }]} />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'junin' } });
  expect(screen.getByRole('heading', { name: 'Jazz de noche' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Huaylarsh en vivo' })).toBeNull();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'sin coincidencias' } });
  expect(screen.getByRole('status').textContent).toContain('No encontramos');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
  expect(screen.getByRole('link', { name: 'Huaylarsh en vivo' }).getAttribute('href')).toBe('/e/huaylarsh');
});

it('never invents listings when the database has no published events', () => {
  render(<EventCatalog events={[]} />);
  expect(screen.getByText('La próxima fiesta puede ser la tuya.')).toBeTruthy();
  expect(screen.queryByRole('searchbox')).toBeNull();
  expect(screen.getByRole('link', { name: 'Crear un evento' }).getAttribute('href')).toBe('/crear-evento');
});

it('filters availability without losing the search query', () => {
  render(<EventCatalog events={[base, { ...base, id: 'two', slug: 'agotado', title: 'Fiesta agotada', available: 0 }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Agotados' }));
  expect(screen.getByRole('heading', { name: 'Fiesta agotada' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Huaylarsh en vivo' })).toBeNull();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Huaylarsh' } });
  expect(screen.getByRole('status').textContent).toContain('No encontramos');
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
  expect(screen.getByRole('heading', { name: 'Huaylarsh en vivo' })).toBeTruthy();
});
