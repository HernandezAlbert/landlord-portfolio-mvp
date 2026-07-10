import { prisma } from "@/lib/prisma";
import { getTenancyArrears } from "@/lib/arrears";
import { sendEmailSafe, formatMoney } from "@/lib/email";
import { getPaymentStatus, ensureRentScheduleForTenancy } from "@/lib/rent";
import { redirect } from "next/navigation";
import { ConfirmSubmit } from "@/app/(app)/components/ConfirmSubmit";
import { requireSessionUser } from "@/lib/auth";
import { formatGBPFromPence, poundsToPence } from "@/lib/money";
import { formatRentWithFrequency, getRentFrequency } from "@/lib/tenancy-rent";

function documentTypeLabel(type: string) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function money(pence: number) {
  return formatGBPFromPence(pence);
}

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function TenancyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;
  const qs = (await searchParams) ?? {};
  const sent = typeof qs.sent === "string" ? qs.sent : "";
  const error = typeof qs.error === "string" ? decodeURIComponent(qs.error) : "";

  const ownedTenancy = await prisma.tenancy.findFirst({
    where: {
      id,
      deletedAt: null,
      property: {
        userId: user.id,
        deletedAt: null,
      },
    },
    select: { id: true },
  });

  if (!ownedTenancy) redirect("/tenancies");

  await ensureRentScheduleForTenancy(user.id, id, new Date());

  const tenancyResult = await prisma.tenancy.findFirst({
    where: {
      id,
      deletedAt: null,
      property: {
        userId: user.id,
        deletedAt: null,
      },
    },
    include: {
      property: true,
      tenants: {
        include: {
          tenant: true,
        },
      },
    },
  });

  if (!tenancyResult) redirect("/tenancies");

  const tenancy = tenancyResult;
  const asOf = new Date();

  const [recentPayments, recentNotices, recentContacts, referenceDocuments, allTenants] =
    await Promise.all([
      prisma.payment.findMany({
        where: {
          tenancyId: id,
          deletedAt: null,
          dueDate: { gte: asOf },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
      }),
      prisma.notice.findMany({
        where: { tenancyId: id, deletedAt: null },
        orderBy: { dateServed: "desc" },
        take: 3,
      }),
      prisma.contactLog.findMany({
        where: { tenancyId: id, deletedAt: null },
        orderBy: { date: "desc" },
        take: 5,
      }),
      prisma.applicantDocument.findMany({
        where: {
          tenancyId: id,
          applicant: {
            userId: user.id,
          },
        },
        include: {
          applicant: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tenant.findMany({
        where: {
          userId: user.id,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const arrears = await getTenancyArrears(user.id, tenancy.id, asOf);
  const existingTenantIds = new Set(tenancy.tenants.map((tt) => tt.tenantId));
  const availableToAdd = allTenants.filter((t) => !existingTenantIds.has(t.id));

  async function addPayment(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!owned) redirect("/tenancies");

    const dueDate = String(formData.get("dueDate") ?? "").trim();
    const amountDue = poundsToPence(formData.get("amountDue"));
    const amountPaid = poundsToPence(formData.get("amountPaid"));
    const paidDate = String(formData.get("paidDate") ?? "").trim();
    const method = String(formData.get("method") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!dueDate || !amountDue) redirect(`/tenancies/${id}`);

    await prisma.payment.create({
      data: {
        tenancyId: id,
        dueDate: new Date(dueDate),
        amountDue,
        amountPaid,
        paidDate: paidDate ? new Date(paidDate) : null,
        method: method || null,
        notes: notes || null,
      },
    });

    redirect(`/tenancies/${id}`);
  }

  async function addNotice(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!owned) redirect("/tenancies");

    const type = String(formData.get("type") ?? "OTHER");
    const dateServed = String(formData.get("dateServed") ?? "").trim();
    const method = String(formData.get("method") ?? "OTHER");
    const notes = String(formData.get("notes") ?? "").trim();

    if (!dateServed) redirect(`/tenancies/${id}`);

    await prisma.notice.create({
      data: {
        tenancyId: id,
        type: type as any,
        dateServed: new Date(dateServed),
        method: method as any,
        notes: notes || null,
      },
    });

    redirect(`/tenancies/${id}`);
  }

  async function addContact(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!owned) redirect("/tenancies");

    const type = String(formData.get("type") ?? "NOTE");
    const date = String(formData.get("date") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    const nextFollowUp = String(formData.get("nextFollowUp") ?? "").trim();

    if (!date || !notes) redirect(`/tenancies/${id}`);

    await prisma.contactLog.create({
      data: {
        tenancyId: id,
        type: type as any,
        date: new Date(date),
        subject: subject || null,
        notes,
        nextFollowUp: nextFollowUp ? new Date(nextFollowUp) : null,
      },
    });

    redirect(`/tenancies/${id}`);
  }

  async function addTenantToTenancy(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const tenantId = String(formData.get("tenantId") ?? "");

    const ownedTenancyCheck = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    const ownedTenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: currentUser.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!ownedTenancyCheck || !ownedTenant || !tenantId) {
      redirect(`/tenancies/${id}`);
    }

    await prisma.tenancyTenant
      .create({
        data: {
          tenancyId: id,
          tenantId,
          role: "Joint",
        },
      })
      .catch(() => {});

    redirect(`/tenancies/${id}`);
  }

  async function removeTenantFromTenancy(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const tenantId = String(formData.get("tenantId") ?? "");

    const ownedTenancyCheck = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    const ownedTenant = await prisma.tenant.findFirst({
      where: {
        id: tenantId,
        userId: currentUser.id,
      },
      select: { id: true },
    });

    if (!ownedTenancyCheck || !ownedTenant || !tenantId) {
      redirect(`/tenancies/${id}`);
    }

    await prisma.tenancyTenant
      .delete({
        where: {
          tenancyId_tenantId: { tenancyId: id, tenantId },
        },
      })
      .catch(() => {});

    redirect(`/tenancies/${id}`);
  }

  async function emailArrearsReminder() {
    "use server";

    const currentUser = await requireSessionUser();

    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      include: {
        property: true,
        tenants: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!owned) redirect("/tenancies");

    const currentArrears = await getTenancyArrears(
      currentUser.id,
      owned.id,
      new Date()
    );

    const emails = owned.tenants
      .map((t) => t.tenant.email)
      .filter(Boolean) as string[];

    if (!emails.length || currentArrears <= 0) redirect(`/tenancies/${id}`);

    const subject = `Rent arrears reminder — ${owned.property.name}`;
    const text = `Rent arrears are currently ${formatMoney(
      currentArrears
    )} for ${owned.property.address1}, ${owned.property.postcode}.

Please arrange payment as soon as possible.`;

    const html = `
<p>Rent arrears are currently <strong>${formatMoney(
      currentArrears
    )}</strong> for ${owned.property.address1}, ${owned.property.postcode}.</p>
<p>Please arrange payment as soon as possible.</p>
`;

    for (const to of emails) {
      const result = await sendEmailSafe({ to, subject, text, html });
      if (!result.ok) {
        redirect(`/tenancies/${id}?error=${encodeURIComponent(result.error)}`);
      }
    }

    redirect(`/tenancies/${id}?sent=arrears-email`);
  }

  async function generateRentNow() {
    "use server";

    const currentUser = await requireSessionUser();

    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!owned) redirect("/tenancies");

    await ensureRentScheduleForTenancy(currentUser.id, id, new Date());
    redirect(`/tenancies/${id}`);
  }

  async function saveAutoRent(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const autoGenerateRent =
      String(formData.get("autoGenerateRent") ?? "true") === "true";

    const monthsAhead = Math.min(
      Math.max(Number(formData.get("rentGenerateMonthsAhead") ?? 3), 1),
      24
    );

    await prisma.tenancy.updateMany({
      where: {
        id,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      data: {
        autoGenerateRent,
        rentGenerateMonthsAhead: monthsAhead,
      },
    });

    if (autoGenerateRent) {
      await ensureRentScheduleForTenancy(currentUser.id, id, new Date());
    }

    redirect(`/tenancies/${id}`);
  }

  async function toggleActive(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    const endDate = String(formData.get("endDate") ?? "").trim();

    const owned = await prisma.tenancy.findFirst({
      where: {
        id,
        deletedAt: null,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        propertyId: true,
        endDate: true,
        property: {
          select: {
            name: true,
          },
        },
        tenants: {
          include: {
            tenant: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!owned) redirect("/tenancies");

    if (isActive) {
      const tenantIds = owned.tenants.map((tt) => tt.tenantId);

      const conflictingPropertyTenancy = await prisma.tenancy.findFirst({
        where: {
          id: { not: id },
          propertyId: owned.propertyId,
          deletedAt: null,
          isActive: true,
          property: {
            userId: currentUser.id,
            deletedAt: null,
          },
        },
        select: { id: true },
      });

      if (conflictingPropertyTenancy) {
        redirect(
          `/tenancies/${id}?error=${encodeURIComponent(
            `${owned.property.name} already has another active tenancy. End that tenancy first before saving this one as active.`
          )}`
        );
      }

      if (tenantIds.length > 0) {
        const conflictingTenantTenancy = await prisma.tenancy.findFirst({
          where: {
            id: { not: id },
            deletedAt: null,
            isActive: true,
            property: {
              userId: currentUser.id,
              deletedAt: null,
            },
            tenants: {
              some: {
                tenantId: { in: tenantIds },
              },
            },
          },
          include: {
            property: {
              select: {
                name: true,
              },
            },
            tenants: {
              include: {
                tenant: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        });

        if (conflictingTenantTenancy) {
          const conflictingNames = conflictingTenantTenancy.tenants
            .filter((tt) => tenantIds.includes(tt.tenantId))
            .map((tt) => tt.tenant.fullName)
            .join(", ");

          const propertyName =
            conflictingTenantTenancy.property?.name || "another property";

          redirect(
            `/tenancies/${id}?error=${encodeURIComponent(
              `${
                conflictingNames || "One or more tenants"
              } are already on another active tenancy at ${propertyName}. End that tenancy first before saving this one as active.`
            )}`
          );
        }
      }
    }

    await prisma.tenancy.updateMany({
      where: {
        id,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      data: {
        isActive,
        endDate: !isActive
          ? endDate
            ? new Date(endDate)
            : owned.endDate
          : null,
      },
    });

    redirect(`/tenancies/${id}`);
  }

  async function deleteTenancy() {
    "use server";

    const currentUser = await requireSessionUser();

    await prisma.tenancy.updateMany({
      where: {
        id,
        property: {
          userId: currentUser.id,
          deletedAt: null,
        },
      },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    redirect("/tenancies");
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {sent ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Arrears reminder email sent.
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tenancy</h1>
          <p className="text-slate-600">
            {tenancy.property.name} — Start{" "}
            {tenancy.startDate.toISOString().slice(0, 10)} — Rent{" "}
            {formatRentWithFrequency(tenancy)}
          </p>
        </div>

        <div className="flex gap-2">
          <a
            href={`/tenancies/${id}/edit`}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Edit
          </a>

          <form action={deleteTenancy}>
            <ConfirmSubmit
              title="Archive tenancy?"
              description="This will hide the tenancy from active lists."
              confirmText="Archive tenancy"
              className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700"
            >
              Archive
            </ConfirmSubmit>
          </form>

          <a
            href="/tenancies"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Back
          </a>
        </div>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Status</h2>
          <div className="text-xl font-semibold">Arrears: {money(arrears)}</div>
        </div>

        {arrears > 0 && (
          <form action={emailArrearsReminder} className="mt-3">
            <button className="rounded-xl border px-4 py-2 text-sm font-medium">
              Email arrears reminder
            </button>
          </form>
        )}

        <form action={toggleActive} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            <span className="mb-1 block text-slate-700">Active?</span>
            <select
              name="isActive"
              defaultValue={tenancy.isActive ? "true" : "false"}
              className="rounded-xl border px-3 py-2"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            <span className="mb-1 block text-slate-700">
              End date (if not active)
            </span>
            <input
              type="date"
              name="endDate"
              defaultValue={fmt(tenancy.endDate)}
              className="rounded-xl border px-3 py-2"
            />
          </label>

          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Save
          </button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Automatic rent tracking ({getRentFrequency(tenancy).toLowerCase()})</h2>
            <p className="mt-1 text-slate-600">
              Automatically creates missing rent due rows ahead of time based on the tenancy start date and rent frequency, so arrears and payment status stay current.
            </p>
          </div>

          <form action={generateRentNow}>
            <button className="rounded-xl border px-4 py-2 text-sm font-medium">
              Run now
            </button>
          </form>
        </div>

        <form action={saveAutoRent} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            <span className="mb-1 block text-slate-700">Enabled</span>
            <select
              name="autoGenerateRent"
              defaultValue={tenancy.autoGenerateRent ? "true" : "false"}
              className="rounded-xl border px-3 py-2"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </label>

          <label className="text-sm font-medium">
            <span className="mb-1 block text-slate-700">Months ahead</span>
            <input
              type="number"
              min={1}
              max={24}
              name="rentGenerateMonthsAhead"
              defaultValue={tenancy.rentGenerateMonthsAhead}
              className="w-24 rounded-xl border px-3 py-2"
            />
          </label>

          <div className="text-sm text-slate-500">
            Last run:{" "}
            {tenancy.lastRentGeneratedOn
              ? tenancy.lastRentGeneratedOn
                  .toISOString()
                  .slice(0, 16)
                  .replace("T", " ")
              : "Never"}
          </div>

          <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Save auto-rent settings
          </button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Tenants</h2>

        <ul className="mt-4 space-y-2">
          {tenancy.tenants.map((tt) => (
            <li
              key={tt.tenantId}
              className="flex items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                {tt.tenant.fullName}
                {tt.tenant.email ? ` (${tt.tenant.email})` : ""}
              </div>

              <form action={removeTenantFromTenancy}>
                <input type="hidden" name="tenantId" value={tt.tenantId} />
                <button className="rounded-xl border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>

        <form action={addTenantToTenancy} className="mt-4 flex flex-wrap gap-3">
          <select
            name="tenantId"
            defaultValue=""
            className="rounded-xl border px-3 py-2"
          >
            <option value="">Select…</option>
            {availableToAdd.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
                {t.email ? ` (${t.email})` : ""}
              </option>
            ))}
          </select>

          <button className="rounded-xl border px-4 py-2 text-sm font-medium">
            Add
          </button>

          <a
            href="/tenants/new"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Create new tenant
          </a>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Referencing documents</h2>
            <p className="mt-1 text-sm text-slate-600">
              Documents carried over from the applicant referencing record.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {referenceDocuments.length ? (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">File</th>
                  <th className="pb-2 pr-4">Applicant</th>
                  <th className="pb-2 pr-4">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {referenceDocuments.map((doc) => (
                  <tr key={doc.id} className="border-t">
                    <td className="py-2 pr-4">{documentTypeLabel(doc.docType)}</td>
                    <td className="py-2 pr-4">
                      <a
                        href={`/api/applicants/${doc.applicantId}/documents/${doc.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {doc.originalName}
                      </a>
                    </td>
                    <td className="py-2 pr-4">{doc.applicant.fullName}</td>
                    <td className="py-2 pr-4">{fmt(doc.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-500">No referencing documents linked to this tenancy yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Next 5 payments</h2>
          <div className="flex gap-2">
            <a
              href={`/tenancies/${id}/payments`}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
            >
              View full payment history
            </a>
            <a
              href={`/api/payments/export?tenancyId=${id}`}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
            >
              Export CSV
            </a>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {recentPayments.length ? (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">Due date</th>
                  <th className="pb-2 pr-4">Due</th>
                  <th className="pb-2 pr-4">Paid</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Line arrears</th>
                  <th className="pb-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 pr-4">{fmt(p.dueDate)}</td>
                    <td className="py-2 pr-4">{money(p.amountDue)}</td>
                    <td className="py-2 pr-4">{money(p.amountPaid)}</td>
                    <td className="py-2 pr-4">
                      {getPaymentStatus(
                        p.amountDue,
                        p.amountPaid,
                        p.dueDate,
                        asOf
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {money(p.amountDue - p.amountPaid)}
                    </td>
                    <td className="py-2 pr-4">
                      <a
                        href={`/tenancies/${id}/payments#${p.id}`}
                        className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                      >
                        Edit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-500">No upcoming payments.</p>
          )}
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium">
            + Add payment
          </summary>

          <form action={addPayment} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Due date</span>
              <input
                type="date"
                name="dueDate"
                className="w-full rounded-xl border px-3 py-2"
                required
              />
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">
                Paid date (optional)
              </span>
              <input
                type="date"
                name="paidDate"
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Amount due (£)</span>
              <input
                type="number"
                step="0.01"
                name="amountDue"
                className="w-full rounded-xl border px-3 py-2"
                required
              />
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Amount paid (£)</span>
              <input
                type="number"
                step="0.01"
                name="amountPaid"
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Method</span>
              <input
                type="text"
                name="method"
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Notes</span>
              <input
                type="text"
                name="notes"
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>

            <div className="md:col-span-2">
              <button className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                Add payment
              </button>
            </div>
          </form>
        </details>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Recent notices</h2>
          <a
            href="/notices"
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            View full notice history
          </a>
        </div>

        <div className="mt-4 overflow-x-auto">
          {recentNotices.length ? (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Date served</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2 pr-4">Notes</th>
                  <th className="pb-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentNotices.map((n) => (
                  <tr key={n.id} className="border-t">
                    <td className="py-2 pr-4">{n.type}</td>
                    <td className="py-2 pr-4">{fmt(n.dateServed)}</td>
                    <td className="py-2 pr-4">{n.method}</td>
                    <td className="py-2 pr-4">{n.notes ?? ""}</td>
                    <td className="py-2 pr-4">
                      <a
                        href={`/notices/${n.id}/edit`}
                        className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                      >
                        Edit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-500">No notices logged.</p>
          )}
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium">
            + Add notice
          </summary>

          <form action={addNotice} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Type</span>
              <select name="type" className="w-full rounded-xl border px-3 py-2">
                <option value="SECTION_8">Section 8</option>
                <option value="SECTION_21">Section 21</option>
                <option value="RENT_INCREASE">Rent increase</option>
                <option value="OTHER">Other</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Date served</span>
              <input
                type="date"
                name="dateServed"
                className="w-full rounded-xl border px-3 py-2"
                required
              />
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Method</span>
              <select
                name="method"
                className="w-full rounded-xl border px-3 py-2"
              >
                <option value="EMAIL">Email</option>
                <option value="POST">Post</option>
                <option value="HAND_DELIVERED">Hand delivered</option>
                <option value="OTHER">Other</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Notes</span>
              <input
                type="text"
                name="notes"
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>

            <div className="md:col-span-2">
              <button className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                Add notice
              </button>
            </div>
          </form>
        </details>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Recent contacts</h2>
          <a
            href={`/tenancies/${id}/contacts`}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            View full contact timeline
          </a>
        </div>

        <div className="mt-4 overflow-x-auto">
          {recentContacts.length ? (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Subject</th>
                  <th className="pb-2 pr-4">Next follow-up</th>
                  <th className="pb-2 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {recentContacts.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-2 pr-4">{fmt(c.date)}</td>
                    <td className="py-2 pr-4">{c.type}</td>
                    <td className="py-2 pr-4">{c.subject ?? ""}</td>
                    <td className="py-2 pr-4">{fmt(c.nextFollowUp)}</td>
                    <td className="py-2 pr-4">{c.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-500">No contact entries yet.</p>
          )}
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium">
            + Add contact log
          </summary>

          <form action={addContact} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Date</span>
              <input
                type="date"
                name="date"
                className="w-full rounded-xl border px-3 py-2"
                required
              />
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Type</span>
              <select name="type" className="w-full rounded-xl border px-3 py-2">
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="VISIT">Visit</option>
                <option value="NOTE">Note</option>
              </select>
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Subject</span>
              <input
                type="text"
                name="subject"
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>

            <label className="text-sm font-medium">
              <span className="mb-1 block text-slate-700">Notes</span>
              <input
                type="text"
                name="notes"
                className="w-full rounded-xl border px-3 py-2"
                required
              />
            </label>

            <label className="text-sm font-medium md:col-span-2">
              <span className="mb-1 block text-slate-700">Next follow-up</span>
              <input
                type="date"
                name="nextFollowUp"
                className="w-full rounded-xl border px-3 py-2"
              />
            </label>

            <div className="md:col-span-2">
              <button className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                Add contact
              </button>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}
