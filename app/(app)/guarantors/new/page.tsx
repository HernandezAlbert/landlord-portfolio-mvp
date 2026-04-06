import GuarantorForm from "@/components/guarantors/guarantor-form";

export default async function NewGuarantorPage({
  searchParams,
}: {
  searchParams: Promise<{ applicantId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const applicantId = resolvedSearchParams?.applicantId ?? undefined;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Add guarantor</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create a guarantor record and optionally link it to an applicant.
        </p>

        <div className="mt-6">
          <GuarantorForm applicantId={applicantId} />
        </div>
      </div>
    </div>
  );
}