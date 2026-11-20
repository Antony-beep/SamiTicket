// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import EventPage from '@/app/e/[slug]/page';

vi.mock('next/server', () => ({ connection: async () => {} }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), notFound: () => { throw Error('Not found'); } }));
vi.mock('@/lib/server/data', () => ({ publicEvents: async () => [{id:'one',slug:'fiesta',title:'Fiesta de prueba',description:'Descripción',date:'2099-11-25',startTime:'20:00',venue:'Local',address:'Dirección',city:'Huancayo',latitude:-12,longitude:-75,priceCents:2500,capacity:100,available:10,category:'Música',outdoor:false,status:'published',reference:'',coverSmallUrl:null,coverLargeUrl:null}] }));

it('links mobile purchase access to the real checkout, preserving the full poster and event content', async () => {
  vi.stubGlobal('React', React);
  try {
    const page = await EventPage({params:Promise.resolve({slug:'fiesta'}),searchParams:Promise.resolve({})});
    const doc = new DOMParser().parseFromString(renderToStaticMarkup(page), 'text/html');
    const link = doc.querySelector<HTMLAnchorElement>('a[aria-label="Ver entradas"]');
    expect(link).not.toBeNull();
    expect(link!.hash).toBe('#entradas');
    expect(doc.querySelector('#entradas form #buyer-name')).not.toBeNull();
    expect(doc.querySelector('article')?.textContent).toContain('Sobre la fiesta');
  } finally { vi.unstubAllGlobals(); }
});
