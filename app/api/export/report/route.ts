export const runtime = "nodejs";

import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/reporting";
import { toCsv } from "@/lib/csv";
import { requireSessionUser } from "@/lib/auth";

function getRunPayload(run: any) {
  const snapshot = run.snapshots?.[0];

  if (!snapshot) {
    throw new Error("No snapshot found for this report run");
  }

  const summary = (snapshot.summaryJson as any) || {};
  const warnings = (snapshot.warningsJson as any) || {};

  const rows = Array.isArray(snapshot.rowsJson)
    ? (snapshot.rowsJson as any[])
    : [];

  const propertyTotals = Array.isArray(warnings?.propertyTotals)
    ? warnings.propertyTotals
    : [];

  const categoryTotals = Array.isArray(warnings?.categoryTotals)
    ? warnings.categoryTotals
    : [];

  const warningItems = Array.isArray(warnings?.items)
    ? warnings.items
    : [];

  const summaryRows = [
    {
      section: "Summary",
      report_type: run.type,
      property_scope:
        summary?.propertyScope || run.property?.name || "All properties",
      property_name: "",
      period_start: formatDate(run.periodStart),
      period_end: formatDate(run.periodEnd),
      due_date: formatDate(run.dueDate),
      total_income: summary?.totalIncome || "0.00",
      total_expenses: summary?.totalExpenses || "0.00",
      net: summary?.net || "0.00",
      line_count: summary?.lineCount || 0,
      warnings: warningItems.join(" | "),
    },
    ...propertyTotals.map((row: any) => ({
      section: "Per property",
      report_type: run.type,
      property_scope:
        summary?.propertyScope || run.property?.name || "All properties",
      property_name: row.property || "",
      period_start: formatDate(run.periodStart),
      period_end: formatDate(run.periodEnd),
      due_date: formatDate(run.dueDate),
      total_income: row.income || "",
      total_expenses: row.expenses || "",
      net: row.net || "",
      line_count: "",
      warnings: "",
    })),
    ...categoryTotals.map((row: any) => ({
      section: "Expense category totals",
      report_type: run.type,
      property_scope:
        summary?.propertyScope || run.property?.name || "All properties",
      property_name: "",
      period_start: formatDate(run.periodStart),
      period_end: formatDate(run.periodEnd),
      due_date: formatDate(run.dueDate),
      category: row.category || "",
      total_income: "",
      total_expenses: row.amount || "",
      net: "",
      line_count: "",
      warnings: "",
    })),
  ];

  const detailedRows = rows.map((row) => ({
    date: row.date || "",
    property: row.property || "",
    type: row.type || "",
    category: row.category || "",
    description: row.description || "",
    notes: row.notes || "",
    amount: row.amount || "",
    tenancy: row.tenancy || "",
    reference: row.reference || "",
    source_type: row.sourceType || "",
    source_id: row.sourceId || "",
  }));

  return { summary, warningItems, summaryRows, detailedRows };
}

function getOwnerUserIdFromSnapshot(snapshot: {
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
  return new Response(
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

async function renderPdf(
  run: any,
  payload: ReturnType<typeof getRunPayload>
) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 42;
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 14;

  let y = pageHeight - margin;

  function addPage() {
    page = pdfDoc.addPage([595.28, 841.89]);
    y = page.getHeight() - margin;
  }

  function wrapText(text: string, size = 10) {
    const words = String(text ?? "").split(/\s+/);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, size);

      if (width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
    return lines;
  }

  function writeLine(
    text: string,
    opts?: { size?: number; bold?: boolean; color?: [number, number, number] }
  ) {
    const size = opts?.size ?? 10;
    const useFont = opts?.bold ? bold : font;
    const color = opts?.color ?? [0, 0, 0];

    const lines = wrapText(text, size);

    for (const line of lines) {
      if (y < margin + lineHeight) addPage();

      page.drawText(line, {
        x: margin,
        y,
        size,
        font: useFont,
        color: rgb(color[0], color[1], color[2]),
      });

      y -= lineHeight;
    }
  }

  function spacer(n = 1) {
    y -= lineHeight * n;
    if (y < margin + lineHeight) addPage();
  }

  const title = `${
    run.type === "ANNUAL" ? "Annual" : "Quarterly"
  } accountant pack`;

  writeLine(title, { size: 18, bold: true });
  spacer(0.5);
  writeLine(
    `Property scope: ${
      payload.summary?.propertyScope || run.property?.name || "All properties"
    }`,
    {
      size: 10,
      color: [0.35, 0.35, 0.35],
    }
  );
  writeLine(
    `Period: ${formatDate(run.periodStart)} to ${formatDate(run.periodEnd)}`,
    {
      size: 10,
      color: [0.35, 0.35, 0.35],
    }
  );
  writeLine(`Due date: ${formatDate(run.dueDate)}`, {
    size: 10,
    color: [0.35, 0.35, 0.35],
  });
  writeLine(`Generated: ${formatDate(run.generatedAt)}`, {
    size: 10,
    color: [0.35, 0.35, 0.35],
  });

  spacer();

  writeLine("Summary", { size: 13, bold: true });
  writeLine(`Total income: £${payload.summary?.totalIncome || "0.00"}`, {
    size: 10,
  });
  writeLine(`Total expenses: £${payload.summary?.totalExpenses || "0.00"}`, {
    size: 10,
  });
  writeLine(`Net: £${payload.summary?.net || "0.00"}`, { size: 10 });
  writeLine(`Lines: ${payload.summary?.lineCount || 0}`, { size: 10 });

  spacer();

  writeLine("Per property", { size: 13, bold: true });
  const perPropertyRows = payload.summaryRows.filter(
    (r) => r.section === "Per property"
  );

  if (perPropertyRows.length) {
    for (const row of perPropertyRows) {
      writeLine(
        `${row.property_name}: income £${
          row.total_income || "0.00"
        }, expenses £${row.total_expenses || "0.00"}, net £${
          row.net || "0.00"
        }`,
        { size: 10 }
      );
    }
  } else {
    writeLine("No property subtotals available.", { size: 10 });
  }

  spacer();

  writeLine("Expense categories", { size: 13, bold: true });
  const categoryRows = payload.summaryRows.filter(
    (r) => r.section === "Expense category totals"
  );

  if (categoryRows.length) {
    for (const row of categoryRows) {
      writeLine(`${row.category}: £${row.total_expenses || "0.00"}`, {
        size: 10,
      });
    }
  } else {
    writeLine("No expenses in this period.", { size: 10 });
  }

  if (payload.warningItems.length) {
    spacer();
    writeLine("Warnings", { size: 13, bold: true });

    for (const warning of payload.warningItems) {
      writeLine(`- ${warning}`, { size: 10 });
    }
  }

  spacer();
  writeLine("Detailed lines", { size: 13, bold: true });

  for (const row of payload.detailedRows.slice(0, 30)) {
    writeLine(
      `${row.date} | ${row.property} | ${row.type} | ${row.category} | ${row.amount} | ${row.description}${
        row.notes ? ` | Notes: ${row.notes}` : ""
      }`,
      { size: 9 }
    );
  }

  if (payload.detailedRows.length > 30) {
    writeLine(
      `... plus ${
        payload.detailedRows.length - 30
      } more lines in the detailed CSV.`,
      {
        size: 9,
      }
    );
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function GET(req: Request) {
  try {
    const sessionUser = await requireSessionUser();
    const { searchParams } = new URL(req.url);
    const runId = String(searchParams.get("runId") || "").trim();
    const kind = String(searchParams.get("kind") || "detailed").trim();

    if (!runId) {
      return new Response("Missing runId", { status: 400 });
    }

    if (!["detailed", "summary", "pdf", "pack"].includes(kind)) {
      return new Response("Invalid export kind", { status: 400 });
    }

    const run = await prisma.reportRun.findFirst({
      where: {
        id: runId,
      },
      include: {
        snapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        property: {
          select: {
            id: true,
            name: true,
            userId: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!run) {
      return notFoundResponse();
    }

    if (run.propertyId) {
      if (
        !run.property ||
        run.property.deletedAt ||
        run.property.userId !== sessionUser.id
      ) {
        return notFoundResponse();
      }
    } else {
      const snapshot = run.snapshots?.[0];
      if (!snapshot) {
        return notFoundResponse();
      }

      const ownerUserId = getOwnerUserIdFromSnapshot(snapshot);
      if (!ownerUserId || ownerUserId !== sessionUser.id) {
        return notFoundResponse();
      }
    }

    if (!run.snapshots?.[0]) {
      return new Response("No report snapshot found.\nGenerate the report first.", {
        status: 400,
      });
    }

    const payload = getRunPayload(run);

    if (kind === "pdf") {
      const pdf = await renderPdf(run, payload);

      await prisma.reportRun.update({
        where: { id: run.id },
        data: { status: "EXPORTED" },
      });

      return new Response(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=report-pack-${run.id}.pdf`,
        },
      });
    }

    if (kind === "pack") {
      const zip = new JSZip();

      zip.file(`report-summary-${run.id}.csv`, toCsv(payload.summaryRows));
      zip.file(`report-detailed-${run.id}.csv`, toCsv(payload.detailedRows));
      zip.file(`report-pack-${run.id}.pdf`, await renderPdf(run, payload));
      zip.file(
        "README.txt",
        [
          `Accountant pack for ${
            payload.summary?.propertyScope || run.property?.name || "All properties"
          }`,
          `Period: ${formatDate(run.periodStart)} to ${formatDate(run.periodEnd)}`,
          `Generated: ${formatDate(run.generatedAt)}`,
          payload.warningItems.length
            ? `Warnings: ${payload.warningItems.join(" | ")}`
            : "Warnings: none",
        ].join("\n")
      );

      const content = await zip.generateAsync({ type: "nodebuffer" });

      await prisma.reportRun.update({
        where: { id: run.id },
        data: { status: "EXPORTED" },
      });

      return new Response(content, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename=accountant-pack-${run.id}.zip`,
        },
      });
    }

    const csvRows = kind === "summary" ? payload.summaryRows : payload.detailedRows;
    const filename =
      kind === "summary"
        ? `report-summary-${run.id}.csv`
        : `report-detailed-${run.id}.csv`;

    await prisma.reportRun.update({
      where: { id: run.id },
      data: { status: kind === "summary" ? run.status : "EXPORTED" },
    });

    return new Response(toCsv(csvRows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (err: any) {
    console.error("Export error:", err);
    return new Response(`Export failed: ${err?.message || "Unknown error"}`, {
      status: 500,
    });
  }
}