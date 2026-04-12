import { buildWeeklyActionList } from "@/lib/actions";
import { getTotalArrears } from "@/lib/arrears";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/email";
import { buildMissingDocumentEmail, getUploadedApplicantDocs } from "@/lib/applicant-documents";

export async function buildLandlordDigest(asOf = new Date()) {
  const soon = new Date(asOf);
  soon.setDate(soon.getDate() + 30);

  const [actions, totalArrears, tenancies, followUps, overduePayments, complianceSoon, insuranceSoon, applicants] =
    await Promise.all([
      buildWeeklyActionList(asOf),
      getTotalArrears(asOf),
      prisma.tenancy.findMany({
        where: { isActive: true, deletedAt: null },
        select: { rentMonthly: true },
      }),
      prisma.contactLog.findMany({
        where: { deletedAt: null, nextFollowUp: { not: null, lte: asOf } },
        orderBy: { nextFollowUp: "asc" },
        take: 10,
      }),
      prisma.payment.findMany({
        where: { deletedAt: null, dueDate: { lte: asOf } },
        include: {
          tenancy: {
            include: {
              property: true,
              tenants: { include: { tenant: true } },
            },
          },
        },
        orderBy: { dueDate: "asc" },
        take: 30,
      }),
      prisma.complianceItem.findMany({
        where: { deletedAt: null, expiresOn: { not: null, lte: soon } },
        include: { property: true },
        orderBy: { expiresOn: "asc" },
        take: 12,
      }),
      prisma.insurancePolicy.findMany({
        where: { deletedAt: null, renewalDate: { not: null, lte: soon } },
        include: { property: true },
        orderBy: { renewalDate: "asc" },
        take: 12,
      }),
      prisma.applicant.findMany({
        where: {
          deletedAt: null,
          status: { in: ["APPLIED", "REFERENCING", "MORE_INFO_REQUESTED"] },
        },
        include: { property: true, referencing: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

  const monthlyRent = tenancies.reduce((s, t) => s + t.rentMonthly, 0);
  const redCount = actions.filter((a) => a.rag === "RED").length;
  const top = actions.slice(0, 20);
  const rightToRentSoon = actions.filter((a) => a.category === "TENANT").slice(0, 10);

  const overduePaymentLines = overduePayments
    .filter((p) => p.amountPaid < p.amountDue)
    .slice(0, 10);

  const applicantReminders = (
    await Promise.all(
      applicants.map(async (applicant) => {
        const docs = await getUploadedApplicantDocs(applicant.id);
        const email = buildMissingDocumentEmail({
          applicantName: applicant.fullName,
          propertyName: applicant.property?.name ?? null,
          uploadedDocs: docs,
          referencing: applicant.referencing,
          hasPets: applicant.hasPets,
        });

        return {
          applicant,
          missingItems: email.missingItems,
        };
      }),
    )
  )
    .filter((row) => row.missingItems.length > 0)
    .slice(0, 10);

  const text = [
    `Landlord Portfolio digest (${asOf.toISOString().slice(0, 10)})`,
    "",
    `Monthly rent: ${formatMoney(monthlyRent)}`,
    `Total arrears: ${formatMoney(totalArrears)}`,
    `Red items: ${redCount}`,
    "",
    "Follow-ups due:",
    ...(followUps.length
      ? followUps.map(
          (f) =>
            `- ${f.type}${f.subject ? `: ${f.subject}` : ""} (follow-up ${f.nextFollowUp!.toISOString().slice(0, 10)})`,
        )
      : ["- None"]),
    "",
    "Overdue rent lines:",
    ...(overduePaymentLines.length
      ? overduePaymentLines.map((p) => {
          const outstanding = Math.max(0, p.amountDue - p.amountPaid);
          const tenants = p.tenancy.tenants.map((tt) => tt.tenant.fullName).join(", ") || "No tenants";
          return `- ${p.tenancy.property.name} / ${tenants}: ${formatMoney(outstanding)} outstanding (due ${p.dueDate.toISOString().slice(0, 10)})`;
        })
      : ["- None"]),
    "",
    "Compliance / insurance due within 30 days:",
    ...(complianceSoon.length
      ? complianceSoon.map((c) => `- ${c.property.name}: ${c.type} expires ${c.expiresOn?.toISOString().slice(0, 10)}`)
      : ["- No compliance items due soon"]),
    ...(insuranceSoon.length
      ? insuranceSoon.map((i) => `- ${i.property.name}: insurance renewal ${i.renewalDate?.toISOString().slice(0, 10)}`)
      : ["- No insurance renewals due soon"]),
    "",
    "Active tenant Right to Rent checks due within 60 days:",
    ...(rightToRentSoon.length
      ? rightToRentSoon.map(
          (a) =>
            `- ${a.subject}: ${a.nextAction}${a.dueDate ? ` (expires ${a.dueDate.toISOString().slice(0, 10)})` : ""}`,
        )
      : ["- None"]),
    "",
    "Applicants missing documents:",
    ...(applicantReminders.length
      ? applicantReminders.map(
          (row) =>
            `- ${row.applicant.fullName}${row.applicant.property ? ` (${row.applicant.property.name})` : ""}: ${row.missingItems.join(", ")}`,
        )
      : ["- None"]),
    "",
    "Top actions:",
    ...top.map(
      (a) =>
        `- [${a.rag}] ${a.nextAction} — ${a.subject}${a.dueDate ? ` (due ${a.dueDate.toISOString().slice(0, 10)})` : ""}${a.note ? ` — NOTE: ${a.note}` : ""}`,
    ),
    "",
    `Export actions CSV: ${process.env.APP_BASE_URL ? process.env.APP_BASE_URL + "/api/export/actions" : "(set APP_BASE_URL)"}`,
  ].join("\n");

  const html = `
    <h2>Landlord Portfolio digest (${asOf.toISOString().slice(0, 10)})</h2>
    <ul>
      <li>Monthly rent: ${formatMoney(monthlyRent)}</li>
      <li>Total arrears: ${formatMoney(totalArrears)}</li>
      <li>Red items: ${redCount}</li>
    </ul>

    <h3>Follow-ups due</h3>
    <ul>
      ${
        followUps.length
          ? followUps
              .map(
                (f) =>
                  `<li>${escapeHtml(f.type)}${f.subject ? `: ${escapeHtml(f.subject)}` : ""} (follow-up ${f.nextFollowUp!.toISOString().slice(0, 10)})</li>`,
              )
              .join("")
          : "<li>None</li>"
      }
    </ul>

    <h3>Overdue rent lines</h3>
    <ul>
      ${
        overduePaymentLines.length
          ? overduePaymentLines
              .map((p) => {
                const outstanding = Math.max(0, p.amountDue - p.amountPaid);
                const tenants =
                  p.tenancy.tenants.map((tt) => tt.tenant.fullName).join(", ") || "No tenants";
                return `<li>${escapeHtml(p.tenancy.property.name)} — ${escapeHtml(tenants)} — ${formatMoney(outstanding)} outstanding (due ${p.dueDate.toISOString().slice(0, 10)})</li>`;
              })
              .join("")
          : "<li>None</li>"
      }
    </ul>

    <h3>Compliance / insurance due within 30 days</h3>
    <ul>
      ${
        complianceSoon.length
          ? complianceSoon
              .map(
                (c) =>
                  `<li>${escapeHtml(c.property.name)} — ${escapeHtml(c.type)} expires ${c.expiresOn?.toISOString().slice(0, 10)}</li>`,
              )
              .join("")
          : "<li>No compliance items due soon</li>"
      }
      ${
        insuranceSoon.length
          ? insuranceSoon
              .map(
                (i) =>
                  `<li>${escapeHtml(i.property.name)} — insurance renewal ${i.renewalDate?.toISOString().slice(0, 10)}</li>`,
              )
              .join("")
          : "<li>No insurance renewals due soon</li>"
      }
    </ul>

    <h3>Active tenant Right to Rent checks due within 60 days</h3>
    <ul>
      ${
        rightToRentSoon.length
          ? rightToRentSoon
              .map(
                (a) =>
                  `<li>${escapeHtml(a.subject)} — ${escapeHtml(a.nextAction)}${a.dueDate ? ` (expires ${a.dueDate.toISOString().slice(0, 10)})` : ""}</li>`,
              )
              .join("")
          : "<li>None</li>"
      }
    </ul>

    <h3>Applicants missing documents</h3>
    <ul>
      ${
        applicantReminders.length
          ? applicantReminders
              .map(
                (row) =>
                  `<li>${escapeHtml(row.applicant.fullName)}${
                    row.applicant.property ? ` (${escapeHtml(row.applicant.property.name)})` : ""
                  } — ${escapeHtml(row.missingItems.join(", "))}</li>`,
              )
              .join("")
          : "<li>None</li>"
      }
    </ul>

    <h3>Top actions</h3>
    <ol>
      ${top
        .map(
          (a) =>
            `<li>[${a.rag}] ${escapeHtml(a.nextAction)} — ${escapeHtml(a.subject)}${
              a.dueDate ? ` (due ${a.dueDate.toISOString().slice(0, 10)})` : ""
            }${a.note ? ` — ${escapeHtml(a.note)}` : ""}</li>`,
        )
        .join("")}
    </ol>
  `.trim();

  return { text, html };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}