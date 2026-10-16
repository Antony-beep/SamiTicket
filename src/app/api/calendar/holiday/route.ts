import { NextRequest } from "next/server";

type Holiday = {
  date: string;
  localName: string;
  name: string;
};

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ message: "Fecha inválida." }, { status: 400 });
  }

  const year = date.slice(0, 4);

  try {
    const response = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/PE`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) return Response.json({ holiday: null });

    const holidays = (await response.json()) as Holiday[];
    const holiday = holidays.find((item) => item.date === date);

    return Response.json({
      holiday: holiday
        ? { name: holiday.localName || holiday.name, date: holiday.date }
        : null,
    });
  } catch {
    return Response.json({ holiday: null });
  }
}
