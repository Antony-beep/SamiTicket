// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppFeedback } from '@/components/app-feedback';
import { notify, requestActivity } from '@/lib/feedback';
beforeEach(() => { vi.stubGlobal('React', React); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('keeps errors visible until dismissed and replaces notices without duplicating overlays', () => {
  render(<AppFeedback />);
  act(() => notify({title:'Error de conexión',tone:'error'}));
  expect(screen.getByRole('alert').textContent).toContain('Error de conexión');
  act(() => notify({title:'Reintenta la portada',tone:'error'}));
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.queryByText('Error de conexión')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Cerrar notificación'}));
  expect(screen.queryByRole('alert')).toBeNull();
});
it('keeps indeterminate progress until every concurrent request finishes', () => {
  render(<AppFeedback />);
  act(() => { requestActivity(1); requestActivity(1); });
  expect(screen.getByRole('progressbar',{name:'Solicitudes en curso'}).hasAttribute('aria-valuenow')).toBe(false);
  act(() => requestActivity(-1));
  expect(screen.getByRole('progressbar',{name:'Solicitudes en curso'})).toBeTruthy();
  act(() => requestActivity(-1));
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('celebrates once on arrival at the newly created event, not during navigation', () => {
  render(<AppFeedback />);
  act(() => notify({title:'Evento creado',tone:'success',celebrate:true,eventId:'new-event'}));
  expect(document.querySelectorAll('.confetti i')).toHaveLength(0);
  act(() => window.dispatchEvent(new CustomEvent('samiticket:arrival',{detail:'other-event'})));
  expect(document.querySelectorAll('.confetti i')).toHaveLength(0);
  act(() => window.dispatchEvent(new CustomEvent('samiticket:arrival',{detail:'new-event'})));
  expect(document.querySelectorAll('.confetti i')).toHaveLength(44);
});
