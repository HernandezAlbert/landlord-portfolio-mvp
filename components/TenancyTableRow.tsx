"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function TenancyTableRow({
  id,
  propertyName,
  tenantNames,
  startDate,
  rentLabel,
  arrearsLabel,
  arrearsValue,
  statusLabel,
}: {
  id: string;
  propertyName: string;
  tenantNames: string;
  startDate: string;
  rentLabel: string;
  arrearsLabel: string;
  arrearsValue: number;
  statusLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.body.style.cursor = loading ? "wait" : "default";
    return () => {
      document.body.style.cursor = "default";
    };
  }, [loading]);

  useEffect(() => {
    setLoading(false);
    document.body.style.cursor = "default";
  }, [pathname]);

  function goToTenancy() {
    setLoading(true);
    router.push(`/tenancies/${id}`);
  }

  return (
    <tr
      onClick={goToTenancy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToTenancy();
        }
      }}
      tabIndex={0}
      role="link"
      className="cursor-pointer border-t border-slate-200 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
    >
      <td className="px-4 py-3 font-medium text-slate-900">{propertyName}</td>
      <td className="px-4 py-3 text-slate-700">{tenantNames}</td>
      <td className="px-4 py-3 text-slate-700">{startDate}</td>
      <td className="px-4 py-3 text-slate-700">{rentLabel}</td>
      <td className={`px-4 py-3 font-medium ${arrearsValue > 0 ? "text-red-700" : "text-slate-700"}`}>
        {arrearsLabel}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            statusLabel === "Active"
              ? "bg-green-100 text-green-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {statusLabel}
        </span>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/tenancies/${id}`}
          onClick={(e) => e.stopPropagation()}
          className="btn btn-secondary btn-sm"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}