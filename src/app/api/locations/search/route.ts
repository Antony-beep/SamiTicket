import { NextRequest } from 'next/server';
import { searchLocations } from '@/lib/server/geocoding';
import { api } from '@/lib/server/http';
import { text } from '@/lib/validation';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  return api(async () => {
    const query = text(request.nextUrl.searchParams.get('q'), 'Búsqueda', 160, 3);
    return Response.json({ places: await searchLocations(query) });
  });
}
