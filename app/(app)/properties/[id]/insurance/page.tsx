import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

function fmtDate(v: Date | null | undefined) {
  return v ? v.toISOString().slice(0, 10) : '';
}

function poundsToPence(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export default async function PropertyInsurancePage({ params }: { params: { id: string } }) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: { insurancePolicy: true },
  });

  if (!property || property.deletedAt) redirect('/properties');

  async function saveInsurance(formData: FormData) {
    'use server';

    const provider = String(formData.get('provider') ?? '').trim() || null;
    const policyNumber = String(formData.get('policyNumber') ?? '').trim() || null;
    const coverType = String(formData.get('coverType') ?? '').trim() || null;
    const notes = String(formData.get('notes') ?? '').trim() || null;
    const dateOrNull = (key: string) => {
      const raw = String(formData.get(key) ?? '').trim();
      return raw ? new Date(raw) : null;
    };

    await prisma.insurancePolicy.upsert({
      where: { propertyId: params.id },
      create: {
        propertyId: params.id,
        provider,
        policyNumber,
        coverType,
        annualPremium: poundsToPence(formData.get('annualPremium')),
        monthlyPremium: poundsToPence(formData.get('monthlyPremium')),
        startDate: dateOrNull('startDate'),
        endDate: dateOrNull('endDate'),
        renewalDate: dateOrNull('renewalDate'),
        notes,
      },
      update: {
        provider,
        policyNumber,
        coverType,
        annualPremium: poundsToPence(formData.get('annualPremium')),
        monthlyPremium: poundsToPence(formData.get('monthlyPremium')),
        startDate: dateOrNull('startDate'),
        endDate: dateOrNull('endDate'),
        renewalDate: dateOrNull('renewalDate'),
        notes,
        deletedAt: null,
      },
    });

    redirect(`/properties/${params.id}`);
  }

  async function clearInsurance() {
    'use server';
    await prisma.insurancePolicy.deleteMany({ where: { propertyId: params.id } });
    redirect(`/properties/${params.id}`);
  }

  const policy = property.insurancePolicy;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Insurance details</h1>
          <p className="text-sm text-slate-500">{property.name}</p>
        </div>
        <a href={`/properties/${params.id}`} className="rounded-lg border px-3 py-2">Back</a>
      </div>

      <form action={saveInsurance} className="grid gap-4 rounded-xl border bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Insurer</span>
            <input name="provider" defaultValue={policy?.provider ?? ''} className="rounded border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Policy number</span>
            <input name="policyNumber" defaultValue={policy?.policyNumber ?? ''} className="rounded border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Cover type</span>
            <input name="coverType" defaultValue={policy?.coverType ?? ''} placeholder="e.g. landlord buildings & contents" className="rounded border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Annual premium (£)</span>
            <input name="annualPremium" type="number" step="0.01" defaultValue={policy?.annualPremium ? (policy.annualPremium / 100).toFixed(2) : ''} className="rounded border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Monthly premium (£)</span>
            <input name="monthlyPremium" type="number" step="0.01" defaultValue={policy?.monthlyPremium ? (policy.monthlyPremium / 100).toFixed(2) : ''} className="rounded border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Policy start date</span>
            <input name="startDate" type="date" defaultValue={fmtDate(policy?.startDate)} className="rounded border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Policy end date</span>
            <input name="endDate" type="date" defaultValue={fmtDate(policy?.endDate)} className="rounded border px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Renewal date</span>
            <input name="renewalDate" type="date" defaultValue={fmtDate(policy?.renewalDate)} className="rounded border px-3 py-2" />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span>Notes</span>
          <textarea name="notes" rows={5} defaultValue={policy?.notes ?? ''} className="rounded border px-3 py-2" />
        </label>

        <div className="flex gap-3">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-white">Save insurance</button>
          <a href={`/properties/${params.id}`} className="rounded-lg border px-4 py-2">Cancel</a>
        </div>
      </form>

      {policy ? (
        <form action={clearInsurance}>
          <button type="submit" className="rounded-lg border border-red-300 px-4 py-2 text-red-700">Remove insurance details</button>
        </form>
      ) : null}
    </div>
  );
}
