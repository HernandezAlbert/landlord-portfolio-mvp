"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

type PropertyTableRowProps = {
  id: string;
  name: string;
  address: string;
  rentLabel?: string;
  mortgageLabel: string;
};

export default function PropertyTableRow({
  id,
  name,
  address,
  rentLabel = "Not set",
  mortgageLabel,
}: PropertyTableRowProps) {
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

  function goToProperty() {
    setLoading(true);
    router.push(`/properties/${id}`);
  }

  return (
    <tr
      onClick={goToProperty}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToProperty();
        }
      }}
      tabIndex={0}
      role="link"
      className="cursor-pointer border-t border-slate-200 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
    >
      <td className="px-4 py-3 font-medium text-slate-900">{name}</td>
      <td className="px-4 py-3 text-slate-700">{address}</td>
      <td className="px-4 py-3 text-slate-700">
        {rentLabel === "Not set" ? <span className="text-slate-400">Not set</span> : rentLabel}
      </td>
      <td className="px-4 py-3 text-slate-700">
        {mortgageLabel === "Not set" ? (
          <span className="text-slate-400">Not set</span>
        ) : (
          mortgageLabel
        )}
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/properties/${id}/edit`}
          onClick={(e) => e.stopPropagation()}
          className="btn btn-secondary btn-sm"
        >
          Edit
        </Link>
      </td>
    </tr>
  );
}
