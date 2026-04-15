import { prisma } from "@/lib/prisma";
import { ensureRentSchedulesForAllActiveTenancies } from "@/lib/rent";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const users = await prisma.user.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let tenanciesProcessed = 0;
  let paymentsCreated = 0;

  for (const user of users) {
    const result = await ensureRentSchedulesForAllActiveTenancies(user.id, new Date());
    tenanciesProcessed += result.tenanciesProcessed;
    paymentsCreated += result.paymentsCreated;
  }

  return Response.json({ ok: true, tenanciesProcessed, paymentsCreated });
}