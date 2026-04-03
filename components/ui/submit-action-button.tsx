"use client";

import { useFormStatus } from "react-dom";

type Variant = "primary" | "danger" | "secondary";

const variantClassMap: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  danger: "bg-red-600 text-white hover:bg-red-700",
  secondary: "border border-slate-300 text-slate-700 hover:bg-slate-50",
};

export default function SubmitActionButton({
  idleLabel,
  pendingLabel,
  variant = "primary",
}: {
  idleLabel: string;
  pendingLabel: string;
  variant?: Variant;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-medium ${variantClassMap[variant]} ${
        pending ? "opacity-80" : ""
      }`}
    >
      {pending ? (
        <>
          <span className="app-spinner" />
          {pendingLabel}
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}