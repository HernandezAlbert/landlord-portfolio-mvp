import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function fmt(d: Date | null) { return d ? d.toISOString().slice(0,10) : ""; }

export default async function TenancyContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenancy = await prisma.tenancy.findFirst({ where: { id, deletedAt: null }, include: { property: true } });
  if (!tenancy) redirect('/tenancies');
  const contacts = await prisma.contactLog.findMany({ where: { tenancyId: id, deletedAt: null }, orderBy: { date: 'desc' } });
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div><h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>Contact timeline</h1><div style={{ opacity: 0.75 }}>{tenancy.property.name}</div></div>
        <a href={`/tenancies/${id}`}>← Back to tenancy</a>
      </div>
      <table cellPadding={10} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr><th align="left">Date</th><th align="left">Type</th><th align="left">Subject</th><th align="left">Next follow-up</th><th align="left">Notes</th></tr></thead>
        <tbody>{contacts.map((c) => <tr key={c.id} style={{ borderTop: '1px solid #eee' }}><td>{fmt(c.date)}</td><td>{c.type}</td><td>{c.subject ?? ''}</td><td>{fmt(c.nextFollowUp)}</td><td>{c.notes}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
