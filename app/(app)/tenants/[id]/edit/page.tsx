import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionUser } from "@/lib/auth";

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "";
}

function documentTypeLabel(type: string) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;

  const tenant = await prisma.tenant.findFirst({
    where: {
      id,
      userId: user.id,
      deletedAt: null,
    },
  });

  if (!tenant) redirect("/tenants");

  const referenceDocuments = await prisma.applicantDocument.findMany({
    where: {
      tenantId: tenant.id,
      applicant: {
        userId: user.id,
      },
    },
    include: {
      applicant: {
        select: {
          id: true,
          fullName: true,
        },
      },
      tenancy: {
        select: {
          id: true,
          property: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  async function updateTenant(formData: FormData) {
    "use server";

    const currentUser = await requireSessionUser();

    const ownedTenant = await prisma.tenant.findFirst({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!ownedTenant) redirect("/tenants");

    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;
    const rightToRentExpiresOnRaw = String(
      formData.get("rightToRentExpiresOn") ?? "",
    ).trim();

    if (!fullName) redirect(`/tenants/${id}/edit`);

    await prisma.tenant.updateMany({
      where: {
        id,
        userId: currentUser.id,
        deletedAt: null,
      },
      data: {
        fullName,
        email,
        phone,
        notes,
        rightToRentExpiresOn: rightToRentExpiresOnRaw
          ? new Date(rightToRentExpiresOnRaw)
          : null,
      },
    });

    redirect("/tenants");
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
            Edit tenant
          </h1>
          <div style={{ opacity: 0.75 }}>{tenant.fullName}</div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/tenants" className="btn btn-secondary btn-sm">
            Back
          </Link>
        </div>
      </div>

      <form
        action={updateTenant}
        style={{
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 12,
          display: "grid",
          gap: 12,
        }}
      >
        <label>
          Full name
          <input
            name="fullName"
            defaultValue={tenant.fullName}
            style={{ width: "100%" }}
            required
          />
        </label>

        <label>
          Email
          <input
            name="email"
            defaultValue={tenant.email ?? ""}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Phone
          <input
            name="phone"
            defaultValue={tenant.phone ?? ""}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Right to Rent expiry
          <input
            type="date"
            name="rightToRentExpiresOn"
            defaultValue={fmt(tenant.rightToRentExpiresOn)}
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Notes
          <textarea
            name="notes"
            defaultValue={tenant.notes ?? ""}
            rows={4}
            style={{ width: "100%" }}
          />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" className="btn btn-primary btn-sm">
            Save
          </button>

          <Link href="/tenants" className="btn btn-secondary btn-sm">
            Cancel
          </Link>
        </div>
      </form>

      <section
        style={{
          border: "1px solid #eee",
          borderRadius: 8,
          padding: 12,
          display: "grid",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
            Referencing documents
          </h2>
          <div style={{ opacity: 0.75 }}>
            Documents carried over from the applicant record.
          </div>
        </div>

        {referenceDocuments.length ? (
          <table style={{ width: "100%", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8 }}>Type</th>
                <th style={{ textAlign: "left", padding: 8 }}>File</th>
                <th style={{ textAlign: "left", padding: 8 }}>Tenancy</th>
                <th style={{ textAlign: "left", padding: 8 }}>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {referenceDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td style={{ borderTop: "1px solid #eee", padding: 8 }}>
                    {documentTypeLabel(doc.docType)}
                  </td>
                  <td style={{ borderTop: "1px solid #eee", padding: 8 }}>
                    <a
                      href={`/api/applicants/${doc.applicantId}/documents/${doc.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {doc.originalName}
                    </a>
                  </td>
                  <td style={{ borderTop: "1px solid #eee", padding: 8 }}>
                    {doc.tenancy ? (
                      <Link href={`/tenancies/${doc.tenancy.id}`}>
                        {doc.tenancy.property.name}
                      </Link>
                    ) : (
                      ""
                    )}
                  </td>
                  <td style={{ borderTop: "1px solid #eee", padding: 8 }}>
                    {fmt(doc.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ opacity: 0.75 }}>
            No referencing documents linked to this tenant yet.
          </div>
        )}
      </section>
    </div>
  );
}
