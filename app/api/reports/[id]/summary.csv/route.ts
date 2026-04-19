import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const escape = (val: unknown) =>
    `"${String(val ?? "").replace(/"/g, '""')}"`;

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  return lines.join("\n");
}

function getOwnerUserId(snapshot: {
  summaryJson: unknown;
  warningsJson: unknown;
}) {
  const summary =
    snapshot.summaryJson &&
    typeof snapshot.summaryJson === "object" &&
    !Array.isArray(snapshot.summaryJson)
      ? (snapshot.summaryJson as Record<string, unknown>)
      : null;

  if (typeof summary?.ownerUserId === "string" && summary.ownerUserId) {
    return summary.ownerUserId;
  }

  const warnings =
    snapshot.warningsJson &&
    typeof snapshot.warningsJson === "object" &&
    !Array.isArray(snapshot.warningsJson)
      ? (snapshot.warningsJson as Record<string, unknown>)
      : null;

  if (typeof warnings?.ownerUserId === "string" && warnings.ownerUserId) {
    return warnings.ownerUserId;
  }

  return null;
}

function notFoundResponse() {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Report not found</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background: #f8fafc;
        color: #0f172a;
        margin: 0;
        padding: 32px 16px;
      }
      .card {
        max-width: 560px;
        margin: 48px auto;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      }
      h1 {
        margin: 0 0 8px;
        font-size: 24px;
      }
      p {
        margin: 0 0 20px;
        color: #475569;
        line-height: 1.5;
      }
      a {
        display: inline-block;
        text-decoration: none;
        background: #0f172a;
        color: #ffffff;
        padding: 10px 14px;
        border-radius: 10px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Report not found</h1>
      <p>The report could not be found.</p>
      <a href="/finance/reporting">Back to reporting</a>
    </div>
  </body>
</html>`,
    {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const sessionUser = await requireSessionUser();
  const { id: runId } = await context.params;

  const run = await prisma.reportRun.findFirst({
    where: {
      id: runId,
    },
    include: {
      property: {
        select: {
          userId: true,
          deletedAt: true,
        },
      },
      snapshots: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!run) {
    return notFoundResponse();
  }

  if (run.propertyId) {
    if (!run.property || run.property.deletedAt || run.property.userId !== sessionUser.id) {
      return notFoundResponse();
    }
  } else {
    const snapshot = run.snapshots[0];
    if (!snapshot) {
      return notFoundResponse();
    }

    const ownerUserId = getOwnerUserId(snapshot);
    if (!ownerUserId || ownerUserId !== sessionUser.id) {
      return notFoundResponse();
    }
  }

  const snapshot = run.snapshots[0];
  if (!snapshot) {
    return notFoundResponse();
  }

  const summary =
    snapshot.summaryJson &&
    typeof snapshot.summaryJson === "object" &&
    !Array.isArray(snapshot.summaryJson)
      ? (snapshot.summaryJson as Record<string, unknown>)
      : {};

  const rows = [
    { metric: "Total Income", value: summary.totalIncome ?? "0.00" },
    { metric: "Total Expenses", value: summary.totalExpenses ?? "0.00" },
    { metric: "Net", value: summary.net ?? "0.00" },
  ];

  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${runId}-summary.csv"`,
    },
  });
}