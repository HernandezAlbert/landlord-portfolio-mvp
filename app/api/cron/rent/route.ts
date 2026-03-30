import { ensureRentSchedulesForAllActiveTenancies } from '@/lib/rent';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const result = await ensureRentSchedulesForAllActiveTenancies(new Date());
  return Response.json({ ok: true, ...result });
}
