// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CoverInput } from '@/components/cover-input';
beforeEach(() => { vi.stubGlobal('React', React); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('rejects an unsupported replacement while preserving the existing cover', () => {
  const change = vi.fn();
  render(<CoverInput file={null} currentUrl="/old-cover.webp" onChange={change} errors={{}} />);
  fireEvent.change(screen.getByLabelText('Portada del evento'), { target: { files: [new File(['<svg/>'], 'bad.svg', {type:'image/svg+xml'})] } });
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByText('Usa una imagen JPEG, PNG o WebP estática.')).toBeTruthy();
  expect(screen.getByAltText('Vista previa de la portada').getAttribute('src')).toBe('/old-cover.webp');
});
it('accepts one image through drag-and-drop and blocks drops while processing', () => {
  const change = vi.fn(), file = new File(['png'], 'cover.png', {type:'image/png'});
  const view=render(<CoverInput file={null} onChange={change} errors={{}} />);
  fireEvent.drop(screen.getByRole('button', {name:'Elegir portada o arrastrar una imagen'}), {dataTransfer:{files:[file]}});
  expect(change).toHaveBeenCalledWith(file);
  view.rerender(<CoverInput file={null} onChange={change} errors={{}} disabled />);
  fireEvent.drop(screen.getByRole('button'), {dataTransfer:{files:[file]}});
  expect(change).toHaveBeenCalledTimes(1);
});
