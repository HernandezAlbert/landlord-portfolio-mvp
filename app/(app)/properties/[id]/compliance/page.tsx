import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

const complianceTypes = ['GAS', 'EICR', 'EPC'] as const;
type ComplianceType = (typeof complianceTypes)[number];

function fmtDate(v: Date | null | undefined) {
  return v ? v.toISOString().slice(0, 10) : '';
}

export default async function PropertyCompliancePage({ params }: { params: { id: string } }) {
  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: {
      compliance: { where: { deletedAt: null }, orderBy: { type: 'asc' } },
      inspections: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!property || property.deletedAt) redirect('/properties');

  async function saveCompliance(formData: FormData) {
    'use server';

    for (const type of complianceTypes) {
      const lastDoneRaw = String(formData.get(`${type}_lastDone`) ?? '').trim();
      const expiresOnRaw = String(formData.get(`${type}_expiresOn`) ?? '').trim();
      const notesRaw = String(formData.get(`${type}_notes`) ?? '').trim();

      await prisma.complianceItem.upsert({
        where: { propertyId_type: { propertyId: params.id, type } },
        create: {
          propertyId: params.id,
          type,
          lastDone: lastDoneRaw ? new Date(lastDoneRaw) : null,
          expiresOn: expiresOnRaw ? new Date(expiresOnRaw) : null,
          notes: notesRaw || null,
        },
        update: {
          lastDone: lastDoneRaw ? new Date(lastDoneRaw) : null,
          expiresOn: expiresOnRaw ? new Date(expiresOnRaw) : null,
          notes: notesRaw || null,
          deletedAt: null,
        },
      });
    }

    const inspectionId = String(formData.get('inspectionId') ?? '').trim();
    const inspectionData = {
      lastDate: String(formData.get('inspectionLastDate') ?? '').trim() ? new Date(String(formData.get('inspectionLastDate'))) : null,
      nextDue: String(formData.get('inspectionNextDue') ?? '').trim() ? new Date(String(formData.get('inspectionNextDue'))) : null,
      notes: String(formData.get('inspectionNotes') ?? '').trim() || null,
      deletedAt: null,
    };

    if (inspectionId) {
      await prisma.inspection.update({ where: { id: inspectionId }, data: inspectionData });
    } else {
      await prisma.inspection.create({ data: { propertyId: params.id, ...inspectionData } });
    }

    redirect(`/properties/${params.id}`);
  }

  const byType = new Map<ComplianceType, (typeof property.compliance)[number]>(property.compliance.map((item) => [item.type as ComplianceType, item]));
  const inspection = property.inspections[0] ?? null;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compliance & inspections</h1>
          <p className="text-sm text-slate-500">{property.name}</p>
        </div>
        <a href={`/properties/${params.id}`} className="rounded-lg border px-3 py-2">Back</a>
      </div>

      <form action={saveCompliance} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {complianceTypes.map((type) => {
            const item = byType.get(type);
            return (
              <section key={type} className="space-y-3 rounded-xl border bg-white p-4">
                <h2 className="text-lg font-semibold">{type}</h2>
                <label className="grid gap-1 text-sm">
                  <span>Last completed</span>
                  <input name={`${type}_lastDone`} type="date" defaultValue={fmtDate(item?.lastDone)} className="rounded border px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>Expiry date</span>
                  <input name={`${type}_expiresOn`} type="date" defaultValue={fmtDate(item?.expiresOn)} className="rounded border px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span>Notes</span>
                  <textarea name={`${type}_notes`} rows={4} defaultValue={item?.notes ?? ''} className="rounded border px-3 py-2" />
                </label>
              </section>
            );
          })}
        </div>

        <section className="space-y-3 rounded-xl border bg-white p-4">
          <input type="hidden" name="inspectionId" value={inspection?.id ?? ''} />
          <h2 className="text-lg font-semibold">Inspection tracker</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span>Last inspection date</span>
              <input name="inspectionLastDate" type="date" defaultValue={fmtDate(inspection?.lastDate)} className="rounded border px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span>Next due date</span>
              <input name="inspectionNextDue" type="date" defaultValue={fmtDate(inspection?.nextDue)} className="rounded border px-3 py-2" />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span>Inspection notes</span>
            <textarea name="inspectionNotes" rows={4} defaultValue={inspection?.notes ?? ''} className="rounded border px-3 py-2" />
          </label>
        </section>

        <div className="flex gap-3">
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-white">Save compliance</button>
          <a href={`/properties/${params.id}`} className="rounded-lg border px-4 py-2">Cancel</a>
        </div>
      </form>
    </div>
  );
}
