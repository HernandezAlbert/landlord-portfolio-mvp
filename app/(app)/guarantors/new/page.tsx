import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import GuarantorForm from "@/components/guarantors/guarantor-form";

export default function NewGuarantorPage({
  searchParams,
}: {
  searchParams: { applicantId?: string };
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add Guarantor</h1>

      <GuarantorForm applicantId={searchParams.applicantId} />
    </div>
  );
}