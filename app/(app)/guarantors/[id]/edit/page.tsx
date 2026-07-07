// app/(app)/guarantors/[id]/edit/page.tsx

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/auth";
import { penceToPoundsInputValue } from "@/lib/money";
import GuarantorForm from "@/components/guarantors/guarantor-form";

function moneyInputValue(value?: number | null) {
  if (typeof value !== "number") return "";
  return penceToPoundsInputValue(value);
}

function dateInputValue(value?: Date | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default async function EditGuarantorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSessionUser();
  const { id } = await params;

  const guarantor = await prisma.guarantor.findFirst({
    where: {
      id,
      archivedAt: null,
      applicant: {
        userId: user.id,
      },
    },
  });

  if (!guarantor) notFound();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Edit guarantor</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update guarantor contact, address, employment, and deed details.
        </p>

        <div className="mt-6">
          <GuarantorForm
            guarantorId={guarantor.id}
            applicantId={guarantor.applicantId}
            initialData={{
              firstName: guarantor.firstName,
              lastName: guarantor.lastName,
              email: guarantor.email ?? "",
              phone: guarantor.phone ?? "",
              annualIncome: moneyInputValue(guarantor.annualIncomePence),
              dateOfBirth: dateInputValue(guarantor.dateOfBirth),
              relationshipToApplicant: guarantor.relationshipToApplicant ?? "",
              address1: guarantor.address1 ?? "",
              address2: guarantor.address2 ?? "",
              city: guarantor.city ?? "",
              postcode: guarantor.postcode ?? "",
              employmentStatus: guarantor.employmentStatus ?? "",
              employerName: guarantor.employerName ?? "",
              jobTitle: guarantor.jobTitle ?? "",
              notes: guarantor.notes ?? "",
              deedSigned: guarantor.deedSigned,
            }}
          />
        </div>
      </div>
    </div>
  );
}
