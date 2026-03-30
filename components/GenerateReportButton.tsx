"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateReportButton({
  type,
  year,
  propertyId,
  quarter,
  className,
  label,
}: {
  type: "ANNUAL" | "QUARTERLY";
  year: number;
  propertyId?: string;
  quarter?: number;
  className?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    try {
      setLoading(true);

      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          year,
          propertyId: propertyId || null,
          quarter: quarter ?? null,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        alert(text || "Failed to generate report.");
        return;
      }

      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to generate report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className || "btn btn-primary btn-sm"}
    >
      {loading ? "Generating..." : (label || "Generate report")}
    </button>
  );
}
