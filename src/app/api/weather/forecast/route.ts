import { api } from '@/lib/server/http';
import { AppError, coordinate } from '@/lib/validation';
import { getEventWeather } from '@/lib/server/weather';
import { validDate } from '@/lib/weather';
export async function GET(request: Request) {
  return api(async () => {
    const params = new URL(request.url).searchParams;
    const lat = params.get('latitude'), lng = params.get('longitude');
    const latitude = coordinate(lat?.trim() ? Number(lat) : null, 90), longitude = coordinate(lng?.trim() ? Number(lng) : null, 180);
    if (latitude === null || longitude === null) throw new AppError('Coordenadas inválidas.');
    const date = params.get('date') || undefined, time = params.get('time') || undefined;
    if (date && !validDate(date) || time && (!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new AppError('Fecha u hora inválida.');
    return Response.json(await getEventWeather(latitude, longitude, date, time), { headers: { 'Cache-Control': 'no-store' } });
  });
}
